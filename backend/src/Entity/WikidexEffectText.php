<?php

namespace App\Entity;

use App\Repository\WikidexEffectTextRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Texto de "== Efecto ==" de una habilidad o movimiento, importado del dump offline de
 * WikiDex — fallback de español cuando PokeAPI no tiene `flavor_text_entries` en 'es'
 * para ese recurso (ver .claude/memory/project_pokewebmax_progress.md, sección
 * "paridad total"). Mismo criterio que WikidexFlavorText: entidad propia, no
 * `pokeapi_resource_cache`, porque el dato no viene de PokeAPI.
 */
#[ORM\Entity(repositoryClass: WikidexEffectTextRepository::class)]
#[ORM\Table(name: 'wikidex_effect_text')]
#[ORM\UniqueConstraint(name: 'uniq_resource_type_id', columns: ['resource_type', 'resource_id'])]
class WikidexEffectText
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    /** 'ability' o 'move' — mismo vocabulario que resource_type en pokeapi_resource_cache. */
    #[ORM\Column(length: 32)]
    private string $resourceType;

    #[ORM\Column]
    private int $resourceId;

    #[ORM\Column(type: 'text')]
    private string $text;

    #[ORM\Column]
    private \DateTimeImmutable $importedAt;

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

    public function getText(): string
    {
        return $this->text;
    }

    public function setText(string $text): static
    {
        $this->text = $text;

        return $this;
    }

    public function getImportedAt(): \DateTimeImmutable
    {
        return $this->importedAt;
    }

    public function setImportedAt(\DateTimeImmutable $importedAt): static
    {
        $this->importedAt = $importedAt;

        return $this;
    }
}
