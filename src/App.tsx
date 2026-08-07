import { Bend } from '@/components/canvasui/Bend'
import './App.css'

import img1 from './assets/gallery/1.svg'
import img2 from './assets/gallery/2.svg'
import img3 from './assets/gallery/3.svg'
import img4 from './assets/gallery/4.svg'
import img5 from './assets/gallery/5.svg'
import img6 from './assets/gallery/6.svg'
import img7 from './assets/gallery/7.svg'
import img8 from './assets/gallery/8.svg'
import img9 from './assets/gallery/9.svg'
import img10 from './assets/gallery/10.svg'
import img11 from './assets/gallery/11.svg'
import img12 from './assets/gallery/12.svg'
import img13 from './assets/gallery/13.svg'
import img14 from './assets/gallery/14.svg'

const images = [
  img1, img2, img3, img4, img5, img6, img7,
  img8, img9, img10, img11, img12, img13, img14,
]

const leftColumn = images.filter((_, index) => index % 2 === 0)
const rightColumn = images.filter((_, index) => index % 2 === 1)

function App() {
  return (
    <main className="stage">
      <Bend
        className="bend-shell"
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
          <section className="hero" id="top">
            <h1>A select collection of graphic work I did for IU School of Medicine, CEHP Office as Marketing Designer</h1>
          </section>

          <section className="gallery-columns" aria-label="Gallery">
            <div className="gallery-column">
              {leftColumn.map((src, index) => (
                <div className="gallery-image" key={src}>
                  <img
                    src={src}
                    alt={`Gallery piece ${index * 2 + 1}`}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            <div className="gallery-column">
              {rightColumn.map((src, index) => (
                <div className="gallery-image" key={src}>
                  <img
                    src={src}
                    alt={`Gallery piece ${index * 2 + 2}`}
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </section>
        </div>
      </Bend>
    </main>
  )
}

export default App
