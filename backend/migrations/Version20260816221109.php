<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260816221109 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE wikidex_flavor_text (id INT AUTO_INCREMENT NOT NULL, pokemon_species_id INT NOT NULL, version_slug VARCHAR(32) NOT NULL, text LONGTEXT NOT NULL, imported_at DATETIME NOT NULL, INDEX idx_species (pokemon_species_id), UNIQUE INDEX uniq_species_version (pokemon_species_id, version_slug), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP TABLE wikidex_flavor_text');
    }
}
