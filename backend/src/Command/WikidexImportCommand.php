<?php

namespace App\Command;

use App\Entity\WikidexFlavorText;
use App\Repository\PokeApiResourceCacheRepository;
use App\Repository\WikidexFlavorTextRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\HttpKernel\KernelInterface;

#[AsCommand(
    name: 'app:wikidex:import',
    description: 'Importa a wikidex_flavor_text el JSON generado por scripts/wikidex_export_flavor_text.py',
)]
class WikidexImportCommand extends Command
{
    public function __construct(
        private readonly PokeApiResourceCacheRepository $speciesCacheRepository,
        private readonly WikidexFlavorTextRepository $flavorTextRepository,
        private readonly EntityManagerInterface $entityManager,
        private readonly KernelInterface $kernel,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument(
            'jsonPath',
            InputArgument::OPTIONAL,
            'Ruta al JSON exportado por scripts/wikidex_export_flavor_text.py',
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $jsonPath = (string) ($input->getArgument('jsonPath') ?? $this->kernel->getProjectDir() . '/var/wikidex_import/flavor_text.json');

        if (!is_file($jsonPath)) {
            $io->error(sprintf(
                'No existe "%s". Genéralo antes con: python3 scripts/wikidex_export_flavor_text.py',
                $jsonPath,
            ));

            return Command::FAILURE;
        }

        $entries = json_decode((string) file_get_contents($jsonPath), true, 512, JSON_THROW_ON_ERROR);

        // Título de WikiDex (exacto, con acentos y comillas curvas) -> resourceId de
        // pokemon-species, cruzando por el nombre en español ya cacheado. El cruce es
        // por nombre exacto, sin tabla de mapeo aparte — verificado con casos límite
        // (Nidoran♂/♀, Farfetch’d, Tapu Koko...) en
        // .claude/memory/project_pokewebmax_wikidex_dump_analysis.md.
        $speciesIdByName = [];
        foreach ($this->speciesCacheRepository->findSpeciesLocalizedNames(['es']) as $speciesId => $namesByLanguage) {
            $name = $namesByLanguage['es'] ?? null;
            if ($name !== null) {
                $speciesIdByName[$name] = $speciesId;
            }
        }

        // Filas ya importadas (de una ejecución previa) para hacer upsert sin una
        // consulta SELECT por fila — el dump completo son ~17k entradas, cargarlas
        // todas de una vez es más barato que 17k SELECT sueltos.
        $existing = [];
        foreach ($this->flavorTextRepository->findAll() as $row) {
            $existing[$row->getPokemonSpeciesId() . ':' . $row->getVersionSlug()] = $row;
        }

        $now = new \DateTimeImmutable();
        $matchedSpecies = 0;
        $writtenRows = 0;
        $unmatchedTitles = [];

        foreach ($entries as $entry) {
            $title = (string) $entry['title'];
            $speciesId = $speciesIdByName[$title] ?? null;
            if ($speciesId === null) {
                $unmatchedTitles[] = $title;
                continue;
            }
            ++$matchedSpecies;

            foreach ($entry['versions'] as $versionSlug => $text) {
                $key = $speciesId . ':' . $versionSlug;
                $row = $existing[$key] ?? null;
                if ($row === null) {
                    $row = new WikidexFlavorText($speciesId, $versionSlug);
                    $this->entityManager->persist($row);
                    $existing[$key] = $row;
                }
                $row->setText($text)->setImportedAt($now);
                ++$writtenRows;
            }
        }

        $this->entityManager->flush();

        $io->success(sprintf(
            '%d especies cruzadas (%d filas escritas). %d títulos de WikiDex sin especie correspondiente.',
            $matchedSpecies,
            $writtenRows,
            count($unmatchedTitles),
        ));

        if ($unmatchedTitles !== [] && $output->isVerbose()) {
            $io->listing(array_slice($unmatchedTitles, 0, 30));
        }

        return Command::SUCCESS;
    }
}
