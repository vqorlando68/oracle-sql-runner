import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  let tempFile: string | null = null;
  try {
    const isWindows = process.platform === 'win32';
    if (!isWindows) {
      return NextResponse.json({ error: 'Directory picker only supported on Windows' }, { status: 400 });
    }

    // Write PowerShell script to a temp file to avoid any shell-escaping issues.
    // Creates a hidden topmost owner form so the dialog appears on top of the browser.
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms | Out-Null
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$owner.Width = 1
$owner.Height = 1
$owner.ShowInTaskbar = $false
$owner.Opacity = 0
$owner.Show()
$owner.BringToFront()
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = 'Seleccione la carpeta de destino para el Backup'
$f.ShowNewFolderButton = $true
$result = $f.ShowDialog($owner)
$owner.Dispose()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  Write-Output $f.SelectedPath
}
`.trim();

    tempFile = join(tmpdir(), `select_dir_${Date.now()}.ps1`);
    writeFileSync(tempFile, psScript, 'utf8');

    const cmd = `powershell -STA -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`;

    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 300000,   // 5-minute timeout (user may take time to choose)
      maxBuffer: 1024 * 1024,
    });
    
    if (stderr && stderr.trim()) {
      console.error('Directory selector stderr:', stderr);
    }

    const selectedPath = stdout.trim();
    if (!selectedPath) {
      return NextResponse.json({ cancelled: true });
    }

    return NextResponse.json({ success: true, path: selectedPath });
  } catch (error: any) {
    // If timeout, treat as cancelled
    if (error.killed || error.signal === 'SIGTERM') {
      return NextResponse.json({ cancelled: true });
    }
    return NextResponse.json({ error: error.message || 'Failed to select directory' }, { status: 500 });
  } finally {
    if (tempFile && existsSync(tempFile)) {
      try { unlinkSync(tempFile); } catch {}
    }
  }
}

