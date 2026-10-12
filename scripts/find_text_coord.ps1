Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('C:\Users\REBRAND STUDIO\.gemini\antigravity-ide\brain\6ff1315c-8aea-418f-bb06-81f5211b18b7\media__1791810619177.png')

for ($x = 600; $x -lt 800; $x += 10) {
    $c = $bmp.GetPixel($x, 260)
    Write-Host "Pixel at ($x, 260): R=$($c.R), G=$($c.G), B=$($c.B)"
}
$bmp.Dispose()
