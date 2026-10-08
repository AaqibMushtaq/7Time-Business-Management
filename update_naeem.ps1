$files = Get-ChildItem -Path "src", "supabase" -Recurse -File | Where-Object { $_.Extension -match "\.(ts|tsx|sql)$" }

foreach ($file in $files) {
    $content = Get-Content $file.FullName
    if ($content -match "(?i)nayeem") {
        $content = $content -replace "nayeem", "naeem"
        $content = $content -replace "Nayeem", "Naeem"
        Set-Content -Path $file.FullName -Value $content
        Write-Host "Updated $($file.FullName)"
    }
}
