<?php

namespace App\Entity;

use App\Repository\WikidexVarietyFlavorTextRepository;
use Doctrine\ORM\Mapping as ORM;

/**
 * Descripción propia de una Megaevolución/Gigamax (aspecto, cómo cambia al
 * transformarse...) importada del dump offline de WikiDex — NO es un recurso de
 * PokeAPI (que ni siquiera tiene este dato: comparte la descripción de la especie
 * base para todas sus variantes, ver .claude/memory/project_pokewebmax_progress.md),
 * así que vive en su propia tabla igual que WikidexFlavorText.
 *
 * A diferencia de WikidexFlavorText (indexado por especie + versión de juego), esto
 * es indexado directamente por el NOMBRE de la variante `pokemon` de PokeAPI (ej.
 * 'charizard-mega-x') — no hay variación por juego dentro de una misma forma, WikiDex
 * solo tiene una descripción por Megaevolución/Gigamax, punto. Pedido por David
 * 2026-08-24: para estas formas, este texto se prioriza sobre la descripción de
 * PokeAPI (que en la práctica es la de la especie base, no la de la forma).
 */
#[ORM\Entity(repositoryClass: WikidexVarietyFlavorTextRepository::class)]
#[ORM\Table(name: 'wikidex_variety_flavor_text')]
class WikidexVarietyFlavorText
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    /** Nombre de la fila `pokemon` correspondiente en pokeapi_resource_cache (ej. 'charizard-mega-x'). */
    #[ORM\Column(length: 64, unique: true)]
    private string $pokemonName;

    #[ORM\Column(type: 'text')]
    private string $text;

    #[ORM\Column]
    private \DateTimeImmutable $importedAt;

    public function __construct(string $pokemonName)
    {
        $this->pokemonName = $pokemonName;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getPokemonName(): string
    {
        return $this->pokemonName;
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
