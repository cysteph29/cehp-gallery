import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Bend } from '@/components/canvasui/Bend'
import './App.css'

import img1 from './assets/gallery/1.1.svg'
import img2 from './assets/gallery/2.svg'
import img3 from './assets/gallery/3.svg'
import img4 from './assets/gallery/4.1.svg'
import img5 from './assets/gallery/5.svg'
import img6 from './assets/gallery/6.svg'
import img7 from './assets/gallery/7.svg'
import img8 from './assets/gallery/8.svg'
import img9 from './assets/gallery/9.svg'
import img10 from './assets/gallery/10.1.svg'
import img11 from './assets/gallery/11.1.svg'
import img12 from './assets/gallery/12.svg'
import img13 from './assets/gallery/13.svg'
import img14 from './assets/gallery/14.svg'

const images = [
  img1, img2, img3, img4, img5, img6, img7,
  img8, img9, img10, img11, img12, img13, img14,
]

const HEADING =
  'A select collection of graphic work I did for IU School of Medicine [CEHP] as a marketing designer when I was in grad school.'
const TYPE_INTERVAL = 15 // milliseconds per character
const TILE_ENTRANCE_DELAY = 750
const DISPLAY_FONT = '300 1em "PP Neue Machina Inktrap"'

function App() {
  const stageRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const characterRefs = useRef<Array<HTMLSpanElement | null>>([])
  const typingFrame = useRef(0)
  const tileEntranceTimer = useRef(0)
  const headingCompleteRef = useRef(false)
  const [tileEntranceReady, setTileEntranceReady] = useState(false)

  useLayoutEffect(() => {
    const stage = stageRef.current
    const heading = headingRef.current
    if (!stage || !heading) return

    const updateHeadingBottom = () => {
      const headingBottom =
        heading.getBoundingClientRect().bottom -
        stage.getBoundingClientRect().top
      stage.style.setProperty(
        '--heading-bottom',
        `${Math.ceil(headingBottom)}px`,
      )
    }

    updateHeadingBottom()

    const observer = new ResizeObserver(updateHeadingBottom)
    observer.observe(stage)
    observer.observe(heading)

    void document.fonts.ready.then(updateHeadingBottom)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let cancelled = false

    const releaseTileEntrance = () => {
      tileEntranceTimer.current = window.setTimeout(
        () => setTileEntranceReady(true),
        TILE_ENTRANCE_DELAY,
      )
    }

    const finishHeading = () => {
      if (headingCompleteRef.current) return
      headingCompleteRef.current = true
      releaseTileEntrance()
    }

    const revealAll = () => {
      for (const character of characterRefs.current) {
        if (character) character.style.opacity = '1'
      }
      headingCompleteRef.current = true
      setTileEntranceReady(true)
    }

    const startTyping = () => {
      const start = performance.now()
      let revealed = 0

      const tick = (now: number) => {
        if (cancelled) return
        const nextRevealed = Math.min(
          HEADING.length,
          Math.floor((now - start) / TYPE_INTERVAL),
        )
        while (revealed < nextRevealed) {
          characterRefs.current[revealed]?.style.setProperty('opacity', '1')
          revealed += 1
        }
        if (revealed === HEADING.length) {
          finishHeading()
          return
        }
        typingFrame.current = requestAnimationFrame(tick)
      }

      typingFrame.current = requestAnimationFrame(tick)
    }

    const onMotionChange = () => {
      if (!motionQuery.matches || headingCompleteRef.current) return
      cancelAnimationFrame(typingFrame.current)
      revealAll()
    }

    motionQuery.addEventListener('change', onMotionChange)

    if (motionQuery.matches) {
      revealAll()
    } else {
      void (async () => {
        try {
          await Promise.all([
            document.fonts.load(DISPLAY_FONT, HEADING),
            document.fonts.ready,
          ])
        } catch {
          // Font loading failure intentionally falls through to the CSS fallback.
        }
        if (!cancelled) startTyping()
      })()
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(typingFrame.current)
      window.clearTimeout(tileEntranceTimer.current)
      motionQuery.removeEventListener('change', onMotionChange)
    }
  }, [])

  return (
    <main className="stage" ref={stageRef}>
      <header className="title-layer">
        <h1 ref={headingRef} aria-label={HEADING}>
          <span aria-hidden="true">
            {Array.from(HEADING).map((character, index) => (
              <span
                className="heading-character"
                key={index}
                ref={(element) => {
                  characterRefs.current[index] = element
                }}
              >
                {character}
              </span>
            ))}
          </span>
        </h1>
      </header>

      <Bend
        className="bend-shell"
        transparent
        zone={240}
        angle={80}
        rounding={150}
        perspective={700}
        ease={240}
        smoothing={0.1}
        tumble={0.5}
        tilt={0.5}
        direction="in"
        top
        bottom
        entranceReady={tileEntranceReady}
      >
        <div className="gallery-page">
          <div className="gallery-start-spacer" aria-hidden="true" />
          <section className="gallery-columns" aria-label="Gallery">
            {images.map((src, index) => (
              <div
                key={src}
                className={
                  index % 2 === 0
                    ? 'gallery-row gallery-row--left'
                    : 'gallery-row gallery-row--right'
                }
              >
                <div className="gallery-image" data-bend-tile>
                  <img
                    src={src}
                    alt={`Gallery piece ${index + 1}`}
                    loading="eager"
                  />
                </div>
              </div>
            ))}
          </section>
          <div className="gallery-end-spacer" aria-hidden="true" />
        </div>
      </Bend>
    </main>
  )
}

export default App
