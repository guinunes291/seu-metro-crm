-- Tipologias individuais por projeto + campos de entrega no catálogo
-- Adicionar na tabela projects: data_entrega, stand_vendas, link_tabela
-- Criar tabela tipologias para armazenar unidades extraídas dos tabelões

ALTER TABLE `projects`
  ADD COLUMN `data_entrega` VARCHAR(50) NULL AFTER `regiao`,
  ADD COLUMN `stand_vendas` TEXT NULL AFTER `data_entrega`,
  ADD COLUMN `link_tabela` TEXT NULL AFTER `stand_vendas`;

CREATE TABLE `tipologias` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `projeto_id` INT NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `metragem` DECIMAL(6,2),
  `dormitorios` INT,
  `vagas` INT DEFAULT 0,
  `decorado` TINYINT DEFAULT 0,
  `varanda` VARCHAR(20),
  `enquadramento` VARCHAR(10),
  `valor_tabela` INT,
  `desconto` INT,
  `valor_final` INT,
  `valor_avaliacao` INT,
  `disponivel` TINYINT DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_tipologia_projeto` FOREIGN KEY (`projeto_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE,
  INDEX `tipologia_projeto_idx` (`projeto_id`)
);
