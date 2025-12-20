import { Router, Request, Response } from "express";
import { storagePut } from "./storage";
import { sdk } from "./_core/sdk";

const router = Router();

// Endpoint para upload de foto de perfil
router.post("/upload-foto", async (req: Request, res: Response) => {
  try {
    // Verificar autenticação via SDK
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch (error) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const { file, filename, contentType } = req.body;

    if (!file || !filename) {
      return res.status(400).json({ error: "Arquivo não fornecido" });
    }

    // Extrair dados do base64
    const base64Data = file.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Gerar nome único para o arquivo
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = filename.split(".").pop() || "jpg";
    const fileKey = `profile-photos/${user.id}-${timestamp}-${randomSuffix}.${extension}`;

    // Fazer upload para o S3
    const { url } = await storagePut(fileKey, buffer, contentType || "image/jpeg");

    return res.json({ url, key: fileKey });
  } catch (error) {
    console.error("[Upload] Erro ao fazer upload:", error);
    return res.status(500).json({ error: "Erro ao fazer upload" });
  }
});

export default router;
