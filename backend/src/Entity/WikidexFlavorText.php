<?php

namespace App\Entity;

use App\Repository\WikidexFlavorTextRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Texto de descripción por versión de juego importado del dump offline de WikiDex —
 * NO es un recurso de PokeAPI, así que vive en su propia tabla y no en
 * `pokeapi_resource_cache` (ver .claude/memory/project_pokewebmax_architecture_decisions.md).
 * Se usa como fallback cuando PokeAPI no tiene el flavor text en español para esa
 * versión concreta (ver `flavorTextsByVersion()` en frontend/src/utils/pokemonFicha.js).
 */
#[ORM\Entity(repositoryClass: WikidexFlavorTextRepository::class)]
#[ORM\Table(name: 'wikidex_flavor_text')]
#[ORM\UniqueConstraint(name: 'uniq_species_version', columns: ['pokemon_species_id', 'version_slug'])]
#[ORM\Index(name: 'idx_species', columns: ['pokemon_species_id'])]
class WikidexFlavorText
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    /** resourceId de la fila `pokemon-species` correspondiente en pokeapi_resource_cache. */
    #[ORM\Column]
    private int $pokemonSpeciesId;

    /** Slug de `version` de PokeAPI (ej. 'red', 'scarlet'), no la clave cruda de WikiDex. */
    #[ORM\Column(length: 32)]
    private string $versionSlug;

    #[ORM\Column(type: 'text')]
    private string $text;

    #[ORM\Column]
    private \DateTimeImmutable $importedAt;

    public function __construct(int $pokemonSpeciesId, string $versionSlug)
    {
        $this->pokemonSpeciesId = $pokemonSpeciesId;
        $this->versionSlug = $versionSlug;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getPokemonSpeciesId(): int
    {
        return $this->pokemonSpeciesId;
    }

    public function getVersionSlug(): string
    {
        return $this->versionSlug;
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
