import { _db } from '../server/db.ts';
import { projects, construtoras } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';
import { writeFileSync } from 'fs';

console.log('Exportando projetos...');

const allProjects = await _db
  .select({
    id: projects.id,
    nome: projects.nome,
    construtora: construtoras.nome,
    endereco: projects.endereco,
    bairro: projects.bairro,
    zona: projects.zona,
    regiao: projects.regiao,
    tipo: projects.tipo,
    enquadramento: projects.enquadramento,
    valorMinimo: projects.valorMinimo,
    metragemMinima: projects.metragemMinima,
    metragemMaxima: projects.metragemMaxima,
    dormitorios: projects.dormitorios,
    vagas: projects.vagas,
    linkMateriais: projects.linkMateriais,
    bookPdfUrl: projects.bookPdfUrl,
    imagemCapaUrl: projects.imagemCapaUrl,
    descricao: projects.descricao,
    status: projects.status
  })
  .from(projects)
  .leftJoin(construtoras, eq(projects.construtoraId, construtoras.id))
  .where(eq(projects.status, 'ativo'));

console.log(`Exportados ${allProjects.length} projetos`);

writeFileSync('/tmp/projects_export.json', JSON.stringify(allProjects, null, 2));
console.log('Dados salvos em /tmp/projects_export.json');
