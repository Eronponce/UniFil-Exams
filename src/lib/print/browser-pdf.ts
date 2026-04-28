import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";

const WINDOWS_BROWSER_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const UNIX_BROWSER_CANDIDATES = [
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function execFileAsync(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 90_000 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function waitForFile(filePath: string, timeoutMs = 15_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await fileExists(filePath)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("PDF nao foi gerado pelo navegador headless.");
}

export async function findBrowserPdfExecutable(): Promise<string | null> {
  const envPath = process.env.UNIFIL_PDF_BROWSER?.trim();
  if (envPath && await fileExists(envPath)) return envPath;

  const candidates = process.platform === "win32" ? WINDOWS_BROWSER_CANDIDATES : UNIX_BROWSER_CANDIDATES;
  for (const candidate of candidates) {
    if (await fileExists(candidate)) return candidate;
  }
  return null;
}

export async function renderHtmlPageToPdfBuffer(url: string): Promise<Buffer> {
  const browserPath = await findBrowserPdfExecutable();
  if (!browserPath) {
    throw new Error("Nenhum Chrome/Edge encontrado para exportacao PDF.");
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "unifil-print-"));
  const pdfPath = path.join(tempDir, "exam.pdf");

  try {
    await execFileAsync(browserPath, [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--disable-dev-shm-usage",
      "--run-all-compositor-stages-before-draw",
      "--virtual-time-budget=15000",
      "--print-to-pdf-no-header",
      `--print-to-pdf=${pdfPath}`,
      url,
    ]);

    await waitForFile(pdfPath);
    return await fs.readFile(pdfPath);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
