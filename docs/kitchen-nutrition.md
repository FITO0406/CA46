# Nutrición de las elaboraciones CA46

`lib/kitchen-foods.json` contiene 31 referencias seleccionadas del USDA SR28 (versión revisada de mayo de 2016), descargadas del organismo editor:
https://www.ars.usda.gov/ARSUserFiles/80400535/Data/SR/SR28/dnload/sr28asc.zip

Cada entrada conserva el identificador NDB y la descripción original. Los códigos de nutrientes de `NUT_DATA.txt` son: 208 energía (kcal), 203 proteína, 205 hidratos totales, 269 azúcares, 204 grasas, 606 saturadas, 307 sodio (mg). La sal equivalente se obtiene como sodio × 2,5 / 1000. Los valores ausentes permanecen `null`; no son cero.

El modo automático estima los nutrientes totales del peso comestible de origen y de los ingredientes añadidos, y divide entre el peso final real para expresar el resultado por 100 g. Reconoce alias acotados o una referencia elegida expresamente. Un ingrediente desconocido o sin cantidad en g/kg deja toda la mezcla pendiente. No se presupone una merma fija ni se aplica un factor de retención inventado: el balance supone conservación de nutrientes y se identifica como estimación. No representa pérdidas en jugos/caldo, absorción de aceite no declarada, ni absorción de salmuera. La sal utilizada en un baño y la sal incorporada al alimento son datos distintos.

Cambiar receta, pesos o proceso recalcula en modo automático. El servidor repite el cálculo; no confía en totales automáticos enviados por el navegador. El modo manual exige siete valores válidos del producto terminado. Las etiquetas guardan método, fuente y campos pendientes. Una nueva transformación hereda nutrición únicamente de etiquetas con la marca de este cálculo; elimina los campos generados anteriores para evitar duplicados.

Las elaboraciones nuevas se muestran 10 días desde la fecha de elaboración. `shelf_life_days` y la fecha límite de consumo son independientes de `expires_at` (fin de exposición). La presencia en el visor no autoriza consumir ni transformar un producto después del plazo indicado. La ascendencia provisional se conserva.

Pruebas: `node --test tests/kitchen-nutrition.test.mjs`. Se ejecutan los cálculos y el manejador de guardado real con dependencias de base de datos simuladas.
