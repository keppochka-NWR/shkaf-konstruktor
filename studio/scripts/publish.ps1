# publish.ps1 - reproducible publish of the 3D studio to GitHub Pages (gh-pages worktree).
# ASCII only, Windows PowerShell 5.1, no && / ||.
#
# Usage (from studio/ or anywhere):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publish.ps1 [-Pages <path>] [-SkipTests] [-DryRun] [-Branch <name>]
#
# Steps (each one stops the script on failure):
#   1. branch == $Branch (default claude/studio) and studio/src, studio/public, studio/tests are clean
#   2. npm test + parts-snapshot "shkafy bez izmeneniy" (skipped with -SkipTests)
#   3. npm run build; web/studio/index.html must be newer than the newest file in studio/src; assets/index-*.js must exist;
#      web/studio/models must contain every file of studio/public/models (untracked GLB are copied by vite only if present)
#   4. privacy scan of web/ (py -I scripts/privacy-scan.py ../web --exclude local-projects --strict) -> exit 0 required;
#      --strict = all three token sources must exist (corpus index.json, public/local-projects, corpus privacy-tokens.txt)
#   4b. price guard: published files (web/ without legacy 2D pages) must not contain purchase words
#      (zakup / sebestoim / nacenk / "reshenie Maksa") or supplier names (SFZ, FAM, ATB, MVM, MDM, Pobeda, Mega-Treid, Dreviz);
#      a match stops the publication. The studio build is public by default (client prices only, see studio/src/buildMode.ts
#      and studio/scripts/public-build.ts); STUDIO_MANAGER=1 builds are for local use and are refused here.
#   5. web/studio/version.json = { commit, srcCommit, builtAt }
#   6. robocopy web -> $Pages /MIR /XD local-projects .git /XF .git (protect .git as directory AND worktree file);
#      legacy 2D editor (web/editor.html, web/assets/) is not published: old copies are removed from Pages and
#      editor.html becomes a redirect to studio/ (files stay in the repo)
#   7. git add -A; git commit "Publish studio from <commit>"; git push origin HEAD:gh-pages   (skipped with -DryRun)
#
# -DryRun never commits, never pushes and never changes the Pages folder (robocopy /L).

param(
  [string]$Pages = '..\..\..\pages-n2',
  [switch]$SkipTests,
  [switch]$DryRun,
  [string]$Branch = 'claude/studio',
  [string]$LocalProjects = ''
)
# -LocalProjects: folder with client project files for privacy-scan --names-dir (default: studio/public/local-projects
# next to this script; pass it explicitly when running from a worktree copy that has no local-projects)

$ErrorActionPreference = 'Continue'

function Fail($msg) {
  Write-Host ("FAIL: " + $msg) -ForegroundColor Red
  exit 1
}
function Step($n, $msg) {
  Write-Host ""
  Write-Host ("[" + $n + "] " + $msg) -ForegroundColor Cyan
}

$studio = Split-Path -Parent $PSScriptRoot
$root = Split-Path -Parent $studio
$web = Join-Path $root 'web'
$webStudio = Join-Path $web 'studio'
Set-Location $studio
if (-not $?) { Fail "cannot cd to studio" }
# relative -Pages is resolved from this script's folder (studio/scripts): ..\..\..\pages-n2 = sibling of the repo folder
if ([System.IO.Path]::IsPathRooted($Pages)) { $pagesDir = $Pages } else { $pagesDir = Join-Path $PSScriptRoot $Pages }
$pagesDir = [System.IO.Path]::GetFullPath($pagesDir)

Write-Host ("studio:  " + $studio)
Write-Host ("web:     " + $web)
Write-Host ("pages:   " + $pagesDir)
if ($DryRun) { Write-Host "mode:    DRY RUN (no commit, no push, robocopy /L)" -ForegroundColor Yellow }

# ---------------------------------------------------------------- 1. branch and clean tree
Step 1 "branch and clean source tree"
$cur = (git rev-parse --abbrev-ref HEAD 2>$null | Out-String).Trim()
if (-not $?) { Fail "git rev-parse failed" }
if ($cur -ne $Branch) { Fail ("branch is '" + $cur + "', expected '" + $Branch + "'") }
$dirty = @(git -C $root status --porcelain -- studio/src studio/public studio/tests)
if (-not $?) { Fail "git status failed" }
if ($dirty.Count -gt 0) {
  $dirty | ForEach-Object { Write-Host ("  " + $_) }
  Fail "studio/src, studio/public or studio/tests have uncommitted changes"
}
$commit = (git rev-parse HEAD | Out-String).Trim()
$short = (git rev-parse --short HEAD | Out-String).Trim()
$srcCommit = (git -C $root log -1 --format=%H -- studio/src | Out-String).Trim()
if ($srcCommit.Length -lt 7) { Fail "cannot find last commit touching studio/src" }
Write-Host ("  branch " + $cur + " @ " + $short + ", last src commit " + $srcCommit.Substring(0, 7))

# ---------------------------------------------------------------- 2. tests + parts snapshot
if ($SkipTests) {
  Step 2 "tests skipped (-SkipTests)"
} else {
  Step 2 "npm test"
  npm test
  if (-not $?) { Fail "npm test failed" }
  Step 2 "parts-snapshot (studio wardrobes unchanged)"
  $snap = (npx tsx scripts/parts-snapshot.ts 2>&1 | Out-String)
  $snapOk = $?
  Write-Host $snap
  # expected phrase: "shkafy bez izmeneniy" in Cyrillic, built from char codes to keep this file ASCII
  $phrase = -join ([char]0x0431, [char]0x0435, [char]0x0437, ' ', [char]0x0438, [char]0x0437, [char]0x043C, [char]0x0435, [char]0x043D, [char]0x0435, [char]0x043D, [char]0x0438, [char]0x0439)
  if (-not $snapOk) { Fail "parts-snapshot reported differences" }
  if ($snap.IndexOf($phrase) -lt 0) { Fail "parts-snapshot output does not say 'bez izmeneniy'" }
}

# ---------------------------------------------------------------- 3. build + freshness
Step 3 "npm run build"
$buildStart = Get-Date
npm run build
if (-not $?) { Fail "npm run build failed" }
$index = Join-Path $webStudio 'index.html'
if (-not (Test-Path $index)) { Fail "web/studio/index.html missing after build" }
$indexTime = (Get-Item $index).LastWriteTime
$newestSrc = Get-ChildItem (Join-Path $studio 'src') -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($newestSrc -and $indexTime -lt $newestSrc.LastWriteTime) { Fail ("index.html (" + $indexTime + ") is older than " + $newestSrc.FullName + " (" + $newestSrc.LastWriteTime + ")") }
if ($indexTime -lt $buildStart.AddMinutes(-1)) { Fail "index.html was not rewritten by this build" }
$assets = @(Get-ChildItem (Join-Path $webStudio 'assets') -Filter 'index-*.js' -File -ErrorAction SilentlyContinue)
if ($assets.Count -lt 1) { Fail "web/studio/assets/index-*.js not found" }
$html = Get-Content $index -Raw
$referenced = $assets | Where-Object { $html.IndexOf($_.Name) -ge 0 }
if (@($referenced).Count -lt 1) { Fail "index.html does not reference any built index-*.js" }
Write-Host ("  index.html " + $indexTime.ToString('s') + ", asset " + (@($referenced)[0]).Name)
$pubModels = Join-Path $studio 'public\models'
$webModels = Join-Path $webStudio 'models'
if (Test-Path $pubModels) {
  $missing = @()
  foreach ($f in (Get-ChildItem $pubModels -Recurse -File)) {
    $rel = $f.FullName.Substring($pubModels.Length)
    if (-not (Test-Path (Join-Path $webModels $rel.TrimStart('\')))) { $missing += $rel }
  }
  if ($missing.Count -gt 0) { Fail ("web/studio/models lacks " + $missing.Count + " file(s) from studio/public/models, e.g. " + $missing[0]) }
  Write-Host ("  models: " + (Get-ChildItem $pubModels -Recurse -File).Count + " files copied")
}

# ---------------------------------------------------------------- 4. privacy scan of web/
Step 4 "privacy scan of web/ (without local-projects), all token sources required"
$scanArgs = @($web, '--exclude', 'local-projects', '--exclude', '.git', '--strict')
if ($LocalProjects -ne '') { $scanArgs += @('--names-dir', $LocalProjects) }
py -I (Join-Path $PSScriptRoot 'privacy-scan.py') @scanArgs
if (-not $?) { Fail "privacy-scan found client names in web/ (or a token source is missing)" }

# ---------------------------------------------------------------- 4b. price guard
Step "4b" "price guard: no purchase prices, markup words or supplier names in published files"
if ($env:STUDIO_MANAGER -eq '1') { Fail "STUDIO_MANAGER=1 is a local manager build; unset it before publishing" }
# legacy 2D editor pages: kept in the repo, never published (paths relative to web/)
$legacyFiles = @('editor.html')
$legacyDirs = @('assets')
# Cyrillic patterns as \u escapes to keep this file ASCII:
#   words (any case): zakup | sebestoim | nacenk | reshenie/reshenia Maksa
#   supplier names (exact case): SFZ | FAM | ATB | MVM | MDM (not inside a word) | Pobed[a,y,e,u] | Mega-Treid | Dreviz
$guardWords = New-Object System.Text.RegularExpressions.Regex('(?i)(\u0437\u0430\u043A\u0443\u043F|\u0441\u0435\u0431\u0435\u0441\u0442\u043E\u0438\u043C|\u043D\u0430\u0446\u0435\u043D\u043A|\u0440\u0435\u0448\u0435\u043D\u0438[\u0435\u044F] \u043C\u0430\u043A\u0441\u0430)')
$guardNames = New-Object System.Text.RegularExpressions.Regex('(?<![\u0400-\u04FF])(\u0421\u0424\u0417|\u0424\u0410\u041C|\u0410\u0422\u0411|\u041C\u0412\u041C|\u041C\u0414\u041C)(?![\u0400-\u04FF])|\u041F\u043E\u0431\u0435\u0434[\u0430\u044B\u0435\u0443]|\u041C\u0435\u0433\u0430-\u0422\u0440\u0435\u0439\u0434|\u0414\u0440\u0435\u0432\u0438\u0437')
$textExt = @('.js', '.mjs', '.cjs', '.html', '.htm', '.css', '.json', '.txt', '.md', '.svg', '.map', '.csv', '.xml')
$guardHits = @()
$guardCount = 0
foreach ($f in (Get-ChildItem $web -Recurse -File)) {
  $rel = $f.FullName.Substring($web.Length).TrimStart('\')
  $top = $rel.Split('\')[0]
  if ($legacyFiles -contains $rel -or $legacyDirs -contains $top) { continue }
  if ($rel -match '(^|\\)(local-projects|\.git)(\\|$)') { continue }
  if ($textExt -notcontains $f.Extension.ToLower()) { continue }
  $guardCount++
  $text = [System.IO.File]::ReadAllText($f.FullName, [System.Text.Encoding]::UTF8)
  foreach ($rx in @($guardWords, $guardNames)) {
    foreach ($m in $rx.Matches($text)) {
      $a = [Math]::Max(0, $m.Index - 40)
      $len = [Math]::Min($text.Length - $a, $m.Length + 80)
      $guardHits += ($rel + ' @' + $m.Index + ': ' + ($text.Substring($a, $len) -replace '\s+', ' '))
    }
  }
}
Write-Host ("  scanned " + $guardCount + " text file(s), legacy excluded: " + (($legacyFiles + $legacyDirs) -join ', '))
if ($guardHits.Count -gt 0) {
  $utf8g = New-Object System.Text.UTF8Encoding($false)
  $guardReport = Join-Path $studio 'test-results\price-guard.txt'
  New-Item -ItemType Directory -Force (Split-Path $guardReport) | Out-Null
  [System.IO.File]::WriteAllText($guardReport, ($guardHits -join "`n") + "`n", $utf8g)
  Write-Host ("  " + $guardHits.Count + " match(es), first ones written to " + $guardReport)
  Fail "price guard: purchase words or supplier names found in files to publish"
}
Write-Host "  price guard: 0 matches"

# ---------------------------------------------------------------- 5. version.json
Step 5 "web/studio/version.json"
$builtAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
$json = '{ "commit": "' + $commit + '", "srcCommit": "' + $srcCommit + '", "builtAt": "' + $builtAt + '" }'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $webStudio 'version.json'), $json + "`n", $utf8)
if (-not $?) { Fail "cannot write version.json" }
Write-Host ("  " + $json)

# ---------------------------------------------------------------- 6. robocopy web -> pages
Step 6 "robocopy web -> pages /MIR (local-projects and .git file/directory excluded)"
if (-not (Test-Path $pagesDir)) { Fail ("pages folder not found: " + $pagesDir) }
if (-not (Test-Path (Join-Path $pagesDir '.git'))) { Fail ("pages folder is not a git worktree: " + $pagesDir) }
$pagesRoot = (git -C $pagesDir rev-parse --show-toplevel 2>$null | Out-String).Trim()
if (-not $? -or $pagesRoot -eq '' -or [System.IO.Path]::GetFullPath($pagesRoot) -ne $pagesDir) { Fail "Pages destination is not the root of a valid Git checkout" }
# GitHub Pages must serve the Vite assets directly, including underscore-prefixed files.
if (-not (Test-Path (Join-Path $web '.nojekyll'))) { [System.IO.File]::WriteAllText((Join-Path $web '.nojekyll'), '') }
$xd = @('local-projects', '.git') + @($legacyDirs | ForEach-Object { Join-Path $web $_ })
$xf = @('.git') + @($legacyFiles | ForEach-Object { Join-Path $web $_ })
$rcArgs = @($web, $pagesDir, '/MIR', '/XD') + $xd + @('/XF') + $xf + @('/NFL', '/NDL', '/NJH', '/R:2', '/W:2')
if ($DryRun) { $rcArgs += '/L' }
& robocopy @rcArgs
$rc = $LASTEXITCODE
if ($rc -ge 8) { Fail ("robocopy exit code " + $rc) }
# legacy 2D pages: robocopy does not purge excluded paths, so remove old copies from Pages and leave a redirect to studio/
$redirect = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=studio/"><title>Redirect</title><script>location.replace("studio/"+location.search+location.hash)</script></head><body><a href="studio/">studio/</a></body></html>'
foreach ($d in $legacyDirs) {
  $p = Join-Path $pagesDir $d
  if (Test-Path $p) {
    if ($DryRun) { Write-Host ("  would remove legacy folder from Pages: " + $d) } else { Remove-Item -Recurse -Force $p; if (-not $?) { Fail ("cannot remove legacy " + $p) } ; Write-Host ("  removed legacy folder: " + $d) }
  }
}
foreach ($f in $legacyFiles) {
  if (-not ($f -like '*.html')) { continue }
  if ($DryRun) { Write-Host ("  would write redirect " + $f + " -> studio/") } else { [System.IO.File]::WriteAllText((Join-Path $pagesDir $f), $redirect + "`n", (New-Object System.Text.UTF8Encoding($false))); Write-Host ("  " + $f + " -> redirect to studio/") }
}
git -C $pagesDir rev-parse --git-dir > $null
if (-not $?) { Fail "Pages Git metadata check failed after synchronization" }
Write-Host ("  robocopy exit code " + $rc + " (0 = nothing to do, 1-7 = copied/extra/mismatch, >= 8 = error)")

# ---------------------------------------------------------------- 7. commit + push
if ($DryRun) {
  Step 7 "commit/push skipped (-DryRun)"
  Write-Host ("  would run: git -C " + $pagesDir + " add -A; git commit -m 'Publish studio from " + $short + "'; git push origin HEAD:gh-pages")
  Write-Host ""
  Write-Host "DRY RUN OK" -ForegroundColor Green
  exit 0
}
Step 7 "git add / commit / push gh-pages"
git -C $pagesDir add -A
if (-not $?) { Fail "git add failed in pages" }
$pending = @(git -C $pagesDir status --porcelain)
if ($pending.Count -eq 0) {
  Write-Host "  nothing to commit: pages already match web/"
} else {
  git -C $pagesDir commit -m ("Publish studio from " + $short)
  if (-not $?) { Fail "git commit failed in pages" }
}
git -C $pagesDir push origin HEAD:gh-pages
if (-not $?) { Fail "git push failed" }
Write-Host ""
Write-Host ("PUBLISHED studio from " + $short) -ForegroundColor Green
exit 0
