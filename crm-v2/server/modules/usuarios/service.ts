import type { DrizzleDB } from "../../_core/db.js";
import { getUserById, updateUserStatus, recordPresenca } from "./repository.js";

export async function togglePresenca(
  db: DrizzleDB,
  userId: number
): Promise<"presente" | "ausente"> {
  const user = await getUserById(db, userId);
  if (!user) throw new Error("Usuário não encontrado");
  const novoStatus = user.status === "presente" ? "ausente" : "presente";
  await updateUserStatus(db, userId, novoStatus);
  await recordPresenca(
    db,
    userId,
    novoStatus === "presente" ? "entrada" : "saida",
    user.status,
    novoStatus
  );
  return novoStatus;
}

export async function setPresenca(
  db: DrizzleDB,
  userId: number,
  novoStatus: "presente" | "ausente",
  origem: "manual" | "automatico_fim" | "automatico_3h" | "sistema" = "manual"
): Promise<void> {
  const user = await getUserById(db, userId);
  if (!user || user.status === novoStatus) return;
  await updateUserStatus(db, userId, novoStatus);
  await recordPresenca(
    db,
    userId,
    novoStatus === "presente" ? "entrada" : "saida",
    user.status,
    novoStatus,
    origem
  );
}
