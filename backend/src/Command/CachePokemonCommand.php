<?php

namespace App\Command;

use App\Service\PokeApi\PokemonCacheService;
use App\Service\PokeApi\PokemonNotFoundException;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

#[AsCommand(
    name: 'app:cache:pokemon',
    description: 'Descarga un Pokémon de PokeAPI v2 y lo guarda/actualiza en la caché local',
)]
class CachePokemonCommand extends Command
{
    public function __construct(private readonly PokemonCacheService $cacheService)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addArgument('idOrName', InputArgument::REQUIRED, 'ID numérico o nombre del Pokémon (ej: 25 o pikachu)');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $idOrName = (string) $input->getArgument('idOrName');

        try {
            $result = $this->cacheService->cache($idOrName);
        } catch (PokemonNotFoundException $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        } catch (TransportExceptionInterface $e) {
            $io->error('No se pudo contactar con PokeAPI: ' . $e->getMessage());

            return Command::FAILURE;
        }

        $io->success(sprintf(
            '%s "%s" (#%d). Tipos: %s.',
            $result->wasCached ? 'Actualizado' : 'Cacheado por primera vez',
            $result->entity->getName(),
            $result->entity->getId(),
            implode(', ', $result->entity->getTypes())
        ));

        return Command::SUCCESS;
    }
}
