Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('C:\Users\REBRAND STUDIO\.gemini\antigravity-ide\brain\6ff1315c-8aea-418f-bb06-81f5211b18b7\media__1791810619177.png')

# Let's find the bounding box of the button around (660, 275)
$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
for ($y = 250; $y -lt 320; $y++) {
    for ($x = 600; $x -lt 820; $x++) {
        $c = $bmp.GetPixel($x, $y)
        # Check if not white (card bg is R>250, G>250, B>250)
        if ($c.R -lt 245 -or $c.G -lt 245 -or $c.B -lt 245) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "Button bounds: X from $minX to $maxX, Y from $minY to $maxY"

# Check pixels inside this box
for ($y = $minY - 2; $y -le $maxY + 2; $y += 2) {
    $row = ""
    for ($x = $minX - 5; $x -le $maxX + 5; $x += 4) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.R -lt 100) { $row += "#" }
        elseif ($c.R -gt 240) { $row += "." }
        else { $row += "?" }
    }
    Write-Host $row
}

$bmp.Dispose()
