<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260815144432 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE pokeapi_resource_cache (id INT AUTO_INCREMENT NOT NULL, resource_type VARCHAR(64) NOT NULL, resource_id INT NOT NULL, name VARCHAR(255) NOT NULL, payload JSON NOT NULL, fetched_at DATETIME NOT NULL, INDEX idx_resource_type_name (resource_type, name), UNIQUE INDEX uniq_resource_type_id (resource_type, resource_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('DROP TABLE pokemon_cache');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE pokemon_cache (id INT NOT NULL, name VARCHAR(255) CHARACTER SET utf8mb4 NOT NULL COLLATE `utf8mb4_uca1400_ai_ci`, sprite_url VARCHAR(255) CHARACTER SET utf8mb4 DEFAULT NULL COLLATE `utf8mb4_uca1400_ai_ci`, types JSON NOT NULL, color_name VARCHAR(255) CHARACTER SET utf8mb4 DEFAULT NULL COLLATE `utf8mb4_uca1400_ai_ci`, generation_id INT NOT NULL, fetched_at DATETIME NOT NULL, PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 COLLATE `utf8mb4_uca1400_ai_ci` ENGINE = InnoDB COMMENT = \'\' ');
        $this->addSql('DROP TABLE pokeapi_resource_cache');
    }
}
