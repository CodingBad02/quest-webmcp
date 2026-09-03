/**
 * Where the work lands and what carries it. Marks from Simple Icons (CC0); names without a mark
 * are set as plain wordmarks. Hairline grid with plus-marks at the inner intersections.
 */
import type { JSX } from 'react';

const PATH = {
  osm: 'M2.672 23.969c-.352-.089-.534-.234-1.471-1.168C.085 21.688.014 21.579.018 20.999c0-.645-.196-.414 3.368-3.986 3.6-3.608 3.415-3.451 4.064-3.449.302 0 .378.016.62.14l.277.14 1.744-1.744-.218-.343c-.425-.662-.825-1.629-1.006-2.429a7.657 7.657 0 0 1 1.479-6.44c2.49-3.12 6.959-3.812 10.26-1.588 1.812 1.218 2.99 3.099 3.328 5.314.07.467.07 1.579 0 2.074a7.554 7.554 0 0 1-2.205 4.402 6.712 6.712 0 0 1-1.943 1.401c-.959.483-1.775.71-2.881.803-1.573.131-3.32-.305-4.656-1.163l-.343-.218-1.744 1.744.14.28c.125.241.14.316.14.617.003.651.156.467-3.426 4.049-2.761 2.756-3.186 3.164-3.398 3.261-.271.125-.69.171-.945.106zM17.485 13.95a6.425 6.425 0 0 0 4.603-3.51c1.391-2.899.455-6.306-2.227-8.108-.638-.43-1.529-.794-2.367-.962-.581-.117-1.809-.104-2.414.025a6.593 6.593 0 0 0-2.452 1.064c-.444.315-1.177 1.048-1.487 1.487a6.384 6.384 0 0 0 .38 7.907 6.406 6.406 0 0 0 3.901 2.136c.509.078 1.542.058 2.065-.037zm-3.738 7.376a80.97 80.97 0 0 1-2.196-.651c-.025-.028 1.207-4.396 1.257-4.449.023-.026 4.242 1.152 4.414 1.236.062.026-.003.288-.525 2.102a398.513 398.513 0 0 0-.635 2.236c-.025.087-.069.156-.097.156-.028-.003-1.028-.287-2.219-.631zm2.912.524c0-.053 1.227-4.333 1.246-4.347.047-.034 4.324-1.23 4.341-1.211.019.019-1.199 4.337-1.23 4.36-.02.019-4.126 1.191-4.259 1.218-.054.011-.098 0-.098-.019zm-7.105-1.911c.846-.852 1.599-1.627 1.674-1.728.171-.218.405-.732.472-1.015.026-.118.053-.352.058-.522l.011-.307.182-.051c.103-.028.193-.044.202-.034.023.025-1.207 4.321-1.246 4.36-.02.016-.677.213-1.464.436l-1.425.405 1.537-1.542zm8.289-3.06a1.371 1.371 0 0 1-.059-.187l-.044-.156.156-.028c1.339-.227 2.776-.856 3.908-1.713.16-.125.252-.171.265-.134.054.165.272.95.265.959-.034.034-4.48 1.282-4.492 1.261zm-15.083-1.3c-.05-.039-1.179-3.866-1.264-4.29-.016-.084.146-.044 2.174.536 2.121.604 2.192.629 2.222.74.028.098.011.129-.125.223-.084.059-.769.724-1.523 1.479a63.877 63.877 0 0 1-1.39 1.367c-.016 0-.056-.025-.093-.054zm.821-4.378c-1.188-.343-2.164-.623-2.167-.626-.016-.012 1.261-4.433 1.285-4.46.022-.022 4.422 1.211 4.469 1.252.009.009-.269 1.017-.618 2.239-.576 2.02-.643 2.224-.723 2.22-.05-.003-1.059-.285-2.247-.626zm2.959.538c.012-.031.212-.723.444-1.534l.42-1.476.056.321c.093.556.265 1.188.464 1.741.106.296.187.539.181.545-.008.006-.332.101-.719.212-.389.109-.741.21-.786.224-.058.016-.075.006-.059-.034zM4.905 6.112c-1.187-.339-2.167-.635-2.18-.654-.04-.062-1.246-4.321-1.23-4.338.026-.025 4.31 1.204 4.351 1.246.047.051 1.28 4.379 1.246 4.376L4.91 6.113zm2.148-1.713l-.519-1.806-.078-.28 1.693-.483c.934-.265 1.724-.495 1.76-.508.034-.016-.083.14-.26.336A8.729 8.729 0 0 0 7.69 5.23a4.348 4.348 0 0 0-.132.561c0 .293-.115-.025-.505-1.39z',
  wikidata: 'M0 4.583v14.833h.865V4.583zm1.788 0v14.833h2.653V4.583zm3.518 0v14.832H7.96V4.583zm3.547 0v14.834h.866V4.583zm1.789 0v14.833h.865V4.583zm1.759 0v14.834h2.653V4.583zm3.518 0v14.834h.923V4.583zm1.788 0v14.833h2.653V4.583zm3.64 0v14.834h.865V4.583zm1.788 0v14.834H24V4.583Z',
  chrome: 'M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z',
  cloudflare: 'M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727',
};

function Mark({ d }: { d: string }) {
  return <svg viewBox="0 0 24 24" className="size-6 shrink-0 fill-current" aria-hidden="true"><path d={d} /></svg>;
}

interface Cell { name: string; role: string; mark?: JSX.Element; font?: string }

const CELLS: Cell[] = [
  { name: 'OpenStreetMap', role: 'Where hours and entrances land', mark: <Mark d={PATH.osm} /> },
  { name: 'Wikidata', role: 'Where sources land', mark: <Mark d={PATH.wikidata} /> },
  { name: 'Overpass', role: 'Finds the gaps', font: 'font-mono tracking-[-.02em]' },
  { name: 'iD', role: 'Stages the edit, never uploads', font: 'font-display text-[26px] font-medium' },
  { name: 'WebMCP', role: 'Chrome 149+ agent tools', mark: <Mark d={PATH.chrome} /> },
  { name: 'Nominatim', role: 'Names a place', font: 'font-display text-[22px] font-light tracking-[-.01em]' },
  { name: 'Photon', role: 'Search as you type, by komoot', font: 'font-mono tracking-[.08em] uppercase text-[15px]' },
  { name: 'Cloudflare', role: 'One tiny store', mark: <Mark d={PATH.cloudflare} /> },
];

export function LogoCloud() {
  return (
    <section className="logo-cloud bg-sky-top text-sky-ink" aria-labelledby="logo-cloud-title">
      <div className="mx-auto max-w-[1200px] px-(--gutter) py-14 max-md:py-10">
        <h2 id="logo-cloud-title" className="mb-8 text-center text-[clamp(22px,2.4vw,30px)] leading-[1.2] font-medium tracking-[-.02em] text-balance text-sky-muted">
          Your work <span className="text-sky-ink">lands</span> in the open record.
        </h2>
        <ul className="relative grid grid-cols-4 border border-sky-line max-md:grid-cols-2" role="list">
          {CELLS.map((c, i) => (
            <li key={c.name} className="group relative flex min-h-[112px] flex-col items-center justify-center gap-2 border-sky-line px-4 text-center [&:nth-child(n+2)]:border-l max-md:[&:nth-child(2n+1)]:border-l-0 [&:nth-child(n+5)]:border-t max-md:[&:nth-child(n+3)]:border-t-0 max-md:[&:nth-child(n+3)]:border-t max-md:[&:nth-child(n+3)]:border-sky-line">
              <span className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-.012em] text-sky-ink/80 transition-colors group-hover:text-sky-ink">
                {c.mark}<span className={c.font}>{c.name}</span>
              </span>
              <span className="text-[12px] text-sky-muted/80">{c.role}</span>
              {/* plus-marks at the inner intersections: one per cell that has a cell to its right and below on the wide grid */}
              {i < 3 && <span aria-hidden="true" className="absolute -right-[7px] -bottom-[7px] z-10 text-[14px] leading-none text-sky-ink/70 max-md:hidden">+</span>}
              {(i === 0 || i === 2 || i === 4) && <span aria-hidden="true" className="absolute -right-[7px] -bottom-[7px] z-10 hidden text-[14px] leading-none text-sky-ink/70 max-md:block">+</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
