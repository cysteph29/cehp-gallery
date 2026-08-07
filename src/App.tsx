import { useLayoutEffect, useRef } from 'react'
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
import img10 from './assets/gallery/10.svg'
import img11 from './assets/gallery/11.1.svg'
import img12 from './assets/gallery/12.svg'
import img13 from './assets/gallery/13.svg'
import img14 from './assets/gallery/14.svg'

const images = [
  img1, img2, img3, img4, img5, img6, img7,
  img8, img9, img10, img11, img12, img13, img14,
]

function App() {
  const stageRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

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

  return (
    <main className="stage" ref={stageRef}>
      <header className="title-layer">
        <h1 ref={headingRef}>A select collection of graphic work I did for IU School of Medicine [CEHP] as a marketing designer when I was in grad school.</h1>
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
                <div className="gallery-image">
                  <img
                    src={src}
                    alt={`Gallery piece ${index + 1}`}
                    loading="lazy"
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
