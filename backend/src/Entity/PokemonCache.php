<?php

namespace App\Entity;

use App\Repository\PokemonCacheRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: PokemonCacheRepository::class)]
#[ORM\Table(name: 'pokemon_cache')]
class PokemonCache
{
    #[ORM\Id]
    #[ORM\Column]
    private int $id;

    #[ORM\Column(length: 255)]
    private string $name;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $spriteUrl = null;

    #[ORM\Column(type: 'json')]
    private array $types = [];

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $colorName = null;

    #[ORM\Column]
    private int $generationId;

    #[ORM\Column]
    private \DateTimeImmutable $fetchedAt;

    public function __construct(int $id)
    {
        $this->id = $id;
    }

    public function getId(): int
    {
        return $this->id;
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

    public function getSpriteUrl(): ?string
    {
        return $this->spriteUrl;
    }

    public function setSpriteUrl(?string $spriteUrl): static
    {
        $this->spriteUrl = $spriteUrl;

        return $this;
    }

    public function getTypes(): array
    {
        return $this->types;
    }

    public function setTypes(array $types): static
    {
        $this->types = $types;

        return $this;
    }

    public function getColorName(): ?string
    {
        return $this->colorName;
    }

    public function setColorName(?string $colorName): static
    {
        $this->colorName = $colorName;

        return $this;
    }

    public function getGenerationId(): int
    {
        return $this->generationId;
    }

    public function setGenerationId(int $generationId): static
    {
        $this->generationId = $generationId;

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
