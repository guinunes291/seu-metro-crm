import { verificarPerfilCompletoSync } from "./server/modules/onboarding";

// Simular usuário corretor de teste
const usuarioTeste = {
  id: 0, // será preenchido com ID real
  name: "Corretor Teste Onboarding",
  email: "corretor.teste@example.com",
  role: "corretor" as const,
  perfilCompleto: false,
  fotoUrl: null,
  cpf: null,
  dataNascimento: null,
  telefone: null,
  creci: null,
  situacao: null,
  dataCredenciamento: null,
  dataDescredenciamento: null,
  status: "ausente" as const,
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  cidade: null,
  estado: null,
};

console.log("=== TESTE DE ONBOARDING ===\n");

console.log("1. Verificando perfil VAZIO (recém-criado):");
const resultado1 = verificarPerfilCompletoSync(usuarioTeste);
console.log("   Completo:", resultado1.completo);
console.log("   Campos faltantes:", resultado1.camposFaltantes.join(", "));
console.log("");

console.log("2. Preenchendo apenas dados pessoais:");
const usuarioComDadosPessoais = {
  ...usuarioTeste,
  fotoUrl: "https://example.com/foto.jpg",
  name: "Corretor Teste Onboarding",
  cpf: "123.456.789-00",
  dataNascimento: new Date("1990-01-01"),
  email: "corretor.teste@example.com",
  telefone: "(11) 99999-9999",
};
const resultado2 = verificarPerfilCompletoSync(usuarioComDadosPessoais);
console.log("   Completo:", resultado2.completo);
console.log("   Campos faltantes:", resultado2.camposFaltantes.join(", "));
console.log("");

console.log("3. Adicionando dados profissionais:");
const usuarioComProfissional = {
  ...usuarioComDadosPessoais,
  dataCredenciamento: new Date("2024-01-01"),
  status: "presente" as const,
};
const resultado3 = verificarPerfilCompletoSync(usuarioComProfissional);
console.log("   Completo:", resultado3.completo);
console.log("   Campos faltantes:", resultado3.camposFaltantes.join(", "));
console.log("");

console.log("4. Adicionando endereço completo:");
const usuarioCompleto = {
  ...usuarioComProfissional,
  cep: "01310-100",
  logradouro: "Avenida Paulista",
  numero: "1000",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  estado: "SP",
};
const resultado4 = verificarPerfilCompletoSync(usuarioCompleto);
console.log("   Completo:", resultado4.completo);
console.log("   Campos faltantes:", resultado4.camposFaltantes.join(", "));
console.log("");

console.log("=== RESULTADO FINAL ===");
console.log("✅ Perfil completo:", resultado4.completo);
console.log("✅ Sistema deve desbloquear o corretor");
