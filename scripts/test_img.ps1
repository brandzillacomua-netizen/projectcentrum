Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('C:\Users\REBRAND STUDIO\.gemini\antigravity-ide\brain\6ff1315c-8aea-418f-bb06-81f5211b18b7\media__1791810619177.png')
Write-Host "Size: $($bmp.Width) x $($bmp.Height)"
$greens = 0
$whites = 0
$blacks = 0
for ($x = [int]($bmp.Width * 0.7); $x -lt $bmp.Width; $x += 2) {
    for ($y = [int]($bmp.Height * 0.7); $y -lt $bmp.Height; $y += 2) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.G -gt 150 -and $c.G -gt ($c.R + 40) -and $c.G -gt ($c.B + 40)) { $greens++ }
        if ($c.R -gt 240 -and $c.G -gt 240 -and $c.B -gt 240) { $whites++ }
        if ($c.R -lt 40 -and $c.G -lt 40 -and $c.B -lt 40) { $blacks++ }
    }
}
Write-Host "Greens: $greens | Whites: $whites | Blacks: $blacks"

# Also check around the row button "Видати" at x ~ 85%, y ~ 60%
$rowGreens = 0
$rowWhites = 0
for ($x = [int]($bmp.Width * 0.8); $x -lt [int]($bmp.Width * 0.95); $x += 2) {
    for ($y = [int]($bmp.Height * 0.55); $y -lt [int]($bmp.Height * 0.68); $y += 2) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.G -gt 150 -and $c.G -gt ($c.R + 40)) { $rowGreens++ }
        if ($c.R -gt 240 -and $c.G -gt 240 -and $c.B -gt 240) { $rowWhites++ }
    }
}
Write-Host "Row button Greens: $rowGreens | Whites: $rowWhites"
$bmp.Dispose()
