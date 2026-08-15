<?php

namespace App\Command;

use App\Service\PokeApi\PokeApiCacheService;
use App\Service\PokeApi\ResourceNotFoundException;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;

#[AsCommand(
    name: 'app:cache:resource',
    description: 'Descarga un recurso de PokeAPI v2 y lo guarda en la caché local si no estaba ya cacheado',
)]
class CacheResourceCommand extends Command
{
    public function __construct(private readonly PokeApiCacheService $cacheService)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('resourceType', InputArgument::REQUIRED, 'Recurso de PokeAPI (ej: pokemon-species, move, item, berry, ability)')
            ->addArgument('idOrName', InputArgument::REQUIRED, 'ID numérico o nombre del recurso');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $resourceType = (string) $input->getArgument('resourceType');
        $idOrName = (string) $input->getArgument('idOrName');

        try {
            $result = $this->cacheService->cache($resourceType, $idOrName);
        } catch (ResourceNotFoundException $e) {
            $io->error($e->getMessage());

            return Command::FAILURE;
        } catch (TransportExceptionInterface $e) {
            $io->error('No se pudo contactar con PokeAPI: ' . $e->getMessage());

            return Command::FAILURE;
        }

        $io->success(sprintf(
            '%s "%s" (%s #%d).',
            $result->alreadyCached ? 'Ya estaba cacheado' : 'Cacheado por primera vez',
            $result->entity->getName(),
            $resourceType,
            $result->entity->getResourceId(),
        ));

        return Command::SUCCESS;
    }
}
