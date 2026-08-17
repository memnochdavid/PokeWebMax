<?php

namespace App\Command;

use App\Entity\WikidexEffectText;
use App\Repository\PokeApiResourceCacheRepository;
use App\Repository\WikidexEffectTextRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\HttpKernel\KernelInterface;

/**
 * Importa a wikidex_effect_text el JSON generado por
 * scripts/wikidex_export_effects.py — fallback de español para habilidades/movimientos
 * cuando PokeAPI no trae flavor_text_entries en 'es' (ver
 * .claude/memory/project_pokewebmax_progress.md, sección "paridad total"). El JSON de
 * entrada NO está filtrado por tipo de página (Python exporta cualquier página con
 * sección "== Efecto ==": ítems, bayas, cartas TCG... son 2748, no solo
 * habilidades/movimientos) — este comando es quien sabe qué nombres busca y descarta
 * el resto en silencio.
 */
#[AsCommand(
    name: 'app:wikidex:import-effects',
    description: 'Importa a wikidex_effect_text el JSON generado por scripts/wikidex_export_effects.py',
)]
class WikidexImportEffectsCommand extends Command
{
    /** @var string[] */
    private const RESOURCE_TYPES = ['ability', 'move'];

    public function __construct(
        private readonly PokeApiResourceCacheRepository $resourceCacheRepository,
        private readonly WikidexEffectTextRepository $effectTextRepository,
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
            'Ruta al JSON exportado por scripts/wikidex_export_effects.py',
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $jsonPath = (string) ($input->getArgument('jsonPath') ?? $this->kernel->getProjectDir() . '/var/wikidex_import/effects.json');

        if (!is_file($jsonPath)) {
            $io->error(sprintf(
                'No existe "%s". Genéralo antes con: python3 scripts/wikidex_export_effects.py',
                $jsonPath,
            ));

            return Command::FAILURE;
        }

        $entries = json_decode((string) file_get_contents($jsonPath), true, 512, JSON_THROW_ON_ERROR);
        $textByTitle = [];
        foreach ($entries as $entry) {
            $textByTitle[(string) $entry['title']] = (string) $entry['text'];
        }

        // Igual que WikidexImportCommand con las species: cargar todo lo ya importado
        // de una vez en vez de un SELECT por fila (373 abilities + 937 moves, nada
        // comparado con las ~17k de flavor_text, pero mismo criterio).
        $existing = [];
        foreach ($this->effectTextRepository->findAll() as $row) {
            $existing[$row->getResourceType() . ':' . $row->getResourceId()] = $row;
        }

        $now = new \DateTimeImmutable();
        $matched = 0;
        $unmatched = 0;

        foreach (self::RESOURCE_TYPES as $resourceType) {
            $namesById = $this->resourceCacheRepository->findLocalizedNamesByType($resourceType, ['es', 'es-419']);

            foreach ($namesById as $resourceId => $names) {
                $text = null;
                foreach ($this->titleCandidates($names['es'] ?? null, $names['es-419'] ?? null) as $candidate) {
                    if (isset($textByTitle[$candidate])) {
                        $text = $textByTitle[$candidate];
                        break;
                    }
                }

                if ($text === null) {
                    ++$unmatched;
                    continue;
                }
                ++$matched;

                $key = $resourceType . ':' . $resourceId;
                $row = $existing[$key] ?? null;
                if ($row === null) {
                    $row = new WikidexEffectText($resourceType, $resourceId);
                    $this->entityManager->persist($row);
                    $existing[$key] = $row;
                }
                $row->setText($text)->setImportedAt($now);
            }
        }

        $this->entityManager->flush();

        $io->success(sprintf('%d habilidades/movimientos cruzados, %d sin página correspondiente en WikiDex.', $matched, $unmatched));

        return Command::SUCCESS;
    }

    /**
     * Títulos de página posibles para un nombre de habilidad/movimiento dado su nombre
     * en España y en Hispanoamérica — cuando difieren, WikiDex titula la página como
     * 'Hispanoamérica/España' (ej. 'Tacleada/Placaje' para Tackle). Mismo criterio que
     * effect_title_candidates() en scripts/wikidex_parser.py — mantener sincronizados
     * si cambia uno.
     *
     * @return string[]
     */
    private function titleCandidates(?string $esName, ?string $es419Name): array
    {
        $candidates = [];
        if ($esName !== null) {
            $candidates[] = $esName;
        }
        if ($es419Name !== null && $es419Name !== $esName) {
            $candidates[] = $es419Name;
            $candidates[] = sprintf('%s/%s', $es419Name, $esName);
            $candidates[] = sprintf('%s/%s', $esName, $es419Name);
        }

        return $candidates;
    }
}
