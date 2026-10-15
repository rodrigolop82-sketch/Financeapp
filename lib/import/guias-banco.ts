// Guías para bajar el estado de cuenta, por banco (F5). Datos estáticos: no
// llaman a ningún servicio y no cambian la lectura, que sigue siendo
// independiente del banco.
//
// POR VALIDAR: los pasos de cada banco no se han revisado contra su banca en
// línea real, así que por ahora usan el paso genérico sin nombres de menú.
// Antes de publicar pasos específicos, revisarlos en la banca de cada banco
// y quitar `porValidar`.

export interface GuiaBanco {
  id: string;
  nombre: string;
  pasos: string[];
  consejo: string;
  /** Los pasos aún no se revisaron contra la banca en línea real. */
  porValidar: boolean;
}

const CONSEJO_PDF = 'Si tu banco te deja descargar el PDF, úsalo: se lee mejor que una foto.';

function generica(nombre: string): string[] {
  return [
    `Entra a la banca en línea o a la app de ${nombre}.`,
    'Abre la sección de estados de cuenta de tu cuenta o tarjeta.',
    'Descarga el PDF del mes o toma capturas donde se lean bien los movimientos.',
  ];
}

const BANCOS = ['Banrural', 'BAM', 'Industrial', 'G&T', 'Bantrab', 'BAC Credomatic'] as const;

export const GUIAS_BANCO: GuiaBanco[] = BANCOS.map((nombre) => ({
  id: nombre.toLowerCase().replace(/[^a-z]/g, ''),
  nombre,
  pasos: generica(nombre),
  consejo: CONSEJO_PDF,
  porValidar: true,
}));

export const GUIA_OTRO_BANCO: GuiaBanco = {
  id: 'otro',
  nombre: 'Otro banco',
  pasos: [
    'Entra a la banca en línea de tu banco.',
    'Abre Estados de cuenta.',
    'Descarga el PDF o toma capturas.',
  ],
  consejo: CONSEJO_PDF,
  porValidar: false,
};

/** Bancos en el orden del selector, con "Otro banco" al final. */
export const OPCIONES_GUIA: GuiaBanco[] = [...GUIAS_BANCO, GUIA_OTRO_BANCO];
