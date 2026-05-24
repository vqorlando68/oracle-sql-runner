import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    const isWindows = process.platform === 'win32';
    if (!isWindows) {
      return NextResponse.json({ error: 'Directory picker only supported on Windows' }, { status: 400 });
    }

    // PowerShell script to show FolderBrowserDialog in STA mode
    const cmd = `powershell -STA -NoProfile -ExecutionPolicy Bypass -Command "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Seleccione la carpeta de destino para el Backup'; if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"`;

    const { stdout, stderr } = await execAsync(cmd);
    
    if (stderr && stderr.trim()) {
      console.error('Directory selector stderr:', stderr);
    }

    const selectedPath = stdout.trim();
    if (!selectedPath) {
      return NextResponse.json({ cancelled: true });
    }

    return NextResponse.json({ success: true, path: selectedPath });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to select directory' }, { status: 550 });
  }
}
