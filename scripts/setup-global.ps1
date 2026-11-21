$ErrorActionPreference = "Stop"

$FactoryRoot = Split-Path -Parent $PSScriptRoot
$SourceAgents = Join-Path $FactoryRoot ".opencode\agents"
$SourceCommands = Join-Path $FactoryRoot ".opencode\commands"

$GlobalOpenCode = Join-Path $env:USERPROFILE ".config\opencode"
$GlobalAgents = Join-Path $GlobalOpenCode "agents"
$GlobalCommands = Join-Path $GlobalOpenCode "commands"
$GlobalConfig = Join-Path $GlobalOpenCode "opencode.json"

Write-Host "LandingFactory Root: $FactoryRoot"
Write-Host "Global OpenCode Dir: $GlobalOpenCode"

if (-not (Test-Path $GlobalOpenCode)) {
    New-Item -ItemType Directory -Path $GlobalOpenCode -Force | Out-Null
}

function Ensure-Junction {
    param(
        [string]$LinkPath,
        [string]$TargetPath
    )

    if (Test-Path $LinkPath) {
        $item = Get-Item $LinkPath -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            $currentTarget = $item.Target
            if ($currentTarget -eq $TargetPath) {
                Write-Host "OK: Junction ya apunta correctamente: $LinkPath -> $TargetPath"
                return
            }
            Write-Host "Actualizando junction: $LinkPath"
            cmd /c rmdir "$LinkPath"
        } else {
            $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
            $backup = "${LinkPath}.bak-${stamp}"
            Write-Host "Respaldando carpeta existente: $LinkPath -> $backup"
            Move-Item -Path $LinkPath -Destination $backup
        }
    }

    New-Item -ItemType Junction -Path $LinkPath -Target $TargetPath | Out-Null
    Write-Host "Creado junction: $LinkPath -> $TargetPath"
}

Ensure-Junction -LinkPath $GlobalAgents -Target $SourceAgents
Ensure-Junction -LinkPath $GlobalCommands -Target $SourceCommands

if (Test-Path $GlobalConfig) {
    $backupConfig = "${GlobalConfig}.bak"
    if (-not (Test-Path $backupConfig)) {
        Copy-Item -Path $GlobalConfig -Destination $backupConfig
        Write-Host "Respaldo creado: $backupConfig"
    }
    Write-Host "Config global preservada en: $GlobalConfig"
}

Write-Host "`nConfiguración global de OpenCode completada."
