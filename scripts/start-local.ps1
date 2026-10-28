$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
if (-not (Test-Path -LiteralPath '.env')) {
    $taskBytes = New-Object byte[] 24
    $taskRng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $taskRng.GetBytes($taskBytes)
    $taskRng.Dispose()
    $taskPassword = [BitConverter]::ToString($taskBytes).Replace('-','').ToLower()
    (Get-Content -Raw -LiteralPath '.env.example').Replace('change_me',$taskPassword) | Set-Content -Encoding UTF8 -LiteralPath '.env'
}
docker compose up -d db
if ($LASTEXITCODE -ne 0) { throw 'Abre Docker Desktop y vuelve a ejecutar este script.' }
if (-not (Test-Path -LiteralPath 'node_modules')) {
    npm ci --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
}
$taskHealthy = $false
for ($taskAttempt=0; $taskAttempt -lt 30; $taskAttempt++) {
    docker compose exec -T db pg_isready -U nexo -d nexo *> $null
    if ($LASTEXITCODE -eq 0) { $taskHealthy = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $taskHealthy) { throw 'PostgreSQL no pudo iniciar.' }
npm run db:migrate
if ($LASTEXITCODE -ne 0) { throw 'Fallaron las migraciones.' }
if (-not (Test-Path -LiteralPath 'apps/api/dist/main.js') -or -not (Test-Path -LiteralPath 'apps/web/.next/BUILD_ID')) {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación.' }
}
New-Item -ItemType Directory -Force -Path '.local' | Out-Null
$taskProcesses = @()
foreach ($taskServer in @(
    @{Name='api';Port=4100;Cwd='apps/api';Args=@('dist/main.js');Url='http://localhost:4100/api/health'},
    @{Name='web';Port=3100;Cwd='apps/web';Args=@('../../node_modules/next/dist/bin/next','start','-p','3100');Url='http://localhost:3100/login'}
)) {
    try {
        $taskResponse = Invoke-WebRequest -Uri $taskServer.Url -TimeoutSec 3 -UseBasicParsing
        if ($taskResponse.StatusCode -eq 200) { Write-Host ($taskServer.Name + ' ya está disponible.'); continue }
    } catch {}
    $taskProcess = Start-Process -FilePath (Get-Command node).Source -ArgumentList $taskServer.Args -WorkingDirectory (Join-Path $taskRoot $taskServer.Cwd) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRoot ('.local/'+$taskServer.Name+'.log')) -RedirectStandardError (Join-Path $taskRoot ('.local/'+$taskServer.Name+'.error.log'))
    $taskProcesses += @{Name=$taskServer.Name;Pid=$taskProcess.Id}
}
if ($taskProcesses.Count -gt 0) { $taskProcesses | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath '.local/processes.json' }
Write-Host 'Frontend: http://localhost:3100'
Write-Host 'API: http://localhost:4100/api/health'
Write-Host 'Swagger: http://localhost:4100/api/docs'
