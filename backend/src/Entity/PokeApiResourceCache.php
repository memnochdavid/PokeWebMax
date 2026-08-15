<?php

namespace App\Entity;

use App\Repository\PokeApiResourceCacheRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: PokeApiResourceCacheRepository::class)]
#[ORM\Table(name: 'pokeapi_resource_cache')]
#[ORM\UniqueConstraint(name: 'uniq_resource_type_id', columns: ['resource_type', 'resource_id'])]
#[ORM\Index(name: 'idx_resource_type_name', columns: ['resource_type', 'name'])]
class PokeApiResourceCache
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\Column(length: 64)]
    private string $resourceType;

    #[ORM\Column]
    private int $resourceId;

    #[ORM\Column(length: 255)]
    private string $name;

    #[ORM\Column(type: 'json')]
    private array $payload = [];

    #[ORM\Column]
    private \DateTimeImmutable $fetchedAt;

    public function __construct(string $resourceType, int $resourceId)
    {
        $this->resourceType = $resourceType;
        $this->resourceId = $resourceId;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getResourceType(): string
    {
        return $this->resourceType;
    }

    public function getResourceId(): int
    {
        return $this->resourceId;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;

        return $this;
    }

    public function getPayload(): array
    {
        return $this->payload;
    }

    public function setPayload(array $payload): static
    {
        $this->payload = $payload;

        return $this;
    }

    public function getFetchedAt(): \DateTimeImmutable
    {
        return $this->fetchedAt;
    }

    public function setFetchedAt(\DateTimeImmutable $fetchedAt): static
    {
        $this->fetchedAt = $fetchedAt;

        return $this;
    }
}
