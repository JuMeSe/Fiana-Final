## installation
```
nmp install
```

```
nmp run dev
```

## production
```
nmp run build
```

Le dossier dist est la web root du projet en ligne.

## Narrative design 
- bloquer la navigation de la carte (limite de la carte) avec maxBounds (https://docs.maptiler.com/sdk-js/examples/restrict-bounds/)
- bloquer le zoom (possibilité de zoomer/dézoomer selon une distance) avec une restriction, minZoom, et maxZoom (https://developers.google.com/maps/documentation/javascript/interaction?hl=fr)
- mettre les photos 3D
- inclure les sons en hoover sur les lanternes
- définir un design de carte (éclairage, lanterne allumées etc...)