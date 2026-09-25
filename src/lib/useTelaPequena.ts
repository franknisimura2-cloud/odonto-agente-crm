import { useCallback, useSyncExternalStore } from 'react'

/**
 * Até onde a tela é "de celular", e até onde é "de tablet".
 *
 * ⚠️ OS MESMOS NÚMEROS ESTÃO NO [`index.css`](../index.css), nos
 * `@media (max-width: 767px)`. O estilo deste projeto é inline, e estilo
 * inline não enxerga media query — então o que muda de LAYOUT (esconder a
 * barra, trocar de componente) é decidido aqui, e o que é só AJUSTE de medida
 * (margem da página, fonte dos campos, modal em tela cheia) mora no CSS. Mudou
 * um, mude o outro: se discordarem, entre 768 e o número novo a tela fica com
 * metade de cada versão.
 */
export const LARGURA_CELULAR = 767
export const LARGURA_TABLET = 1023

/**
 * `true` enquanto a janela tiver no máximo `max` pixels de largura, e
 * re-renderiza quando isso muda (girar o celular, redimensionar a janela).
 *
 * `useSyncExternalStore`, e não `useState` + `useEffect`: o valor já nasce
 * certo no primeiro render. Com efeito, o primeiro render sairia com o layout
 * de computador e trocaria em seguida — um piscar da barra lateral inteira em
 * cada abertura no celular.
 */
export function useLarguraAte(max: number): boolean {
  const consulta = `(max-width: ${max}px)`
  const assinar = useCallback((avisar: () => void) => {
    const m = window.matchMedia(consulta)
    m.addEventListener('change', avisar)
    return () => m.removeEventListener('change', avisar)
  }, [consulta])
  return useSyncExternalStore(
    assinar,
    () => window.matchMedia(consulta).matches,
    () => false,
  )
}

/** Celular: a barra lateral vira gaveta, e as telas pesadas trocam de versão. */
export function useTelaPequena(): boolean {
  return useLarguraAte(LARGURA_CELULAR)
}
