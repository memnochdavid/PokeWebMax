<?php

namespace App\Command;

use App\Entity\WikidexVarietyFlavorText;
use App\Repository\PokeApiResourceCacheRepository;
use App\Repository\WikidexVarietyFlavorTextRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\HttpKernel\KernelInterface;

/**
 * Importa a wikidex_variety_flavor_text el JSON generado por
 * scripts/wikidex_export_variety_descriptions.py — descripciones propias de
 * Megaevolución/Gigamax (ver WikidexVarietyFlavorText para el porqué de esta tabla
 * separada de wikidex_flavor_text).
 *
 * A diferencia de WikidexImportCommand (cruce directo título -> pokemon-species), aquí
 * hace falta un segundo salto: título -> pokemon-species -> slug base (`name` de esa
 * fila) -> `<slug>-<forma>` -> comprobar que esa variante `pokemon` esté realmente
 * cacheada antes de escribir la fila. Si no lo está, se descarta sin error (esa
 * variante en concreto no se ha cacheado todavía en este proyecto, no es un fallo del
 * cruce) — se cuenta aparte para que `--verbose` pueda listarlas.
 */
#[AsCommand(
    name: 'app:wikidex:import-varieties',
    description: 'Importa a wikidex_variety_flavor_text el JSON generado por scripts/wikidex_export_variety_descriptions.py',
)]
class WikidexImportVarietiesCommand extends Command
{
    public function __construct(
        private readonly PokeApiResourceCacheRepository $pokeApiRepository,
        private readonly WikidexVarietyFlavorTextRepository $varietyFlavorTextRepository,
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
            'Ruta al JSON exportado por scripts/wikidex_export_variety_descriptions.py',
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $jsonPath = (string) ($input->getArgument('jsonPath') ?? $this->kernel->getProjectDir() . '/var/wikidex_import/variety_descriptions.json');

        if (!is_file($jsonPath)) {
            $io->error(sprintf(
                'No existe "%s". Genéralo antes con: python3 scripts/wikidex_export_variety_descriptions.py',
                $jsonPath,
            ));

            return Command::FAILURE;
        }

        $entries = json_decode((string) file_get_contents($jsonPath), true, 512, JSON_THROW_ON_ERROR);

        // Título de WikiDex -> resourceId de pokemon-species, mismo cruce por nombre
        // en español que WikidexImportCommand.
        $speciesIdByTitle = [];
        foreach ($this->pokeApiRepository->findSpeciesLocalizedNames(['es']) as $speciesId => $namesByLanguage) {
            $name = $namesByLanguage['es'] ?? null;
            if ($name !== null) {
                $speciesIdByTitle[$name] = $speciesId;
            }
        }
        // resourceId de pokemon-species -> su propio slug (ej. 6 -> 'charizard'), para
        // reconstruir el nombre de la variante `pokemon` a partir de la forma
        // (mega/mega-x/mega-y/mega-z/gmax) que devolvió el parser.
        $speciesSlugById = $this->pokeApiRepository->findNamesById('pokemon-species');
        // Todas las variantes `pokemon` ya cacheadas, para comprobar antes de escribir
        // que la forma parseada corresponde a algo que este proyecto realmente tiene.
        $cachedPokemonNames = array_flip($this->pokeApiRepository->findNamesById('pokemon'));

        $existing = [];
        foreach ($this->varietyFlavorTextRepository->findAll() as $row) {
            $existing[$row->getPokemonName()] = $row;
        }

        $now = new \DateTimeImmutable();
        $matchedSpecies = 0;
        $writtenRows = 0;
        $unmatchedTitles = [];
        $uncachedVarieties = [];

        foreach ($entries as $entry) {
            $title = (string) $entry['title'];
            $speciesId = $speciesIdByTitle[$title] ?? null;
            if ($speciesId === null) {
                $unmatchedTitles[] = $title;
                continue;
            }
            $speciesSlug = $speciesSlugById[$speciesId] ?? null;
            if ($speciesSlug === null) {
                continue;
            }
            ++$matchedSpecies;

            foreach ($entry['varieties'] as $form => $text) {
                $pokemonName = $speciesSlug . '-' . $form;
                if (!isset($cachedPokemonNames[$pokemonName])) {
                    $uncachedVarieties[] = $pokemonName;
                    continue;
                }

                $row = $existing[$pokemonName] ?? null;
                if ($row === null) {
                    $row = new WikidexVarietyFlavorText($pokemonName);
                    $this->entityManager->persist($row);
                    $existing[$pokemonName] = $row;
                }
                $row->setText($text)->setImportedAt($now);
                ++$writtenRows;
            }
        }

        $this->entityManager->flush();

        $io->success(sprintf(
            '%d especies cruzadas (%d filas escritas). %d títulos de WikiDex sin especie correspondiente, %d formas sin esa variante cacheada todavía.',
            $matchedSpecies,
            $writtenRows,
            count($unmatchedTitles),
            count($uncachedVarieties),
        ));

        if ($output->isVerbose()) {
            if ($unmatchedTitles !== []) {
                $io->section('Títulos sin especie correspondiente');
                $io->listing(array_slice($unmatchedTitles, 0, 30));
            }
            if ($uncachedVarieties !== []) {
                $io->section('Formas sin esa variante cacheada todavía');
                $io->listing(array_slice($uncachedVarieties, 0, 30));
            }
        }

        return Command::SUCCESS;
    }
}
