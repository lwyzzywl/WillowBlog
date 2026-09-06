import Reveal from './Reveal'

export default function Section({ id, icon: Icon, title, subtitle, children }) {
  return (
    <section id={id} className="relative py-14 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <Reveal>
          <header className="mb-8 text-center md:mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-sm ring-1 ring-amber-100">
              <Icon className="h-4 w-4 text-wood-500" />
              <span className="text-sm font-semibold text-wood-700">{title}</span>
            </div>
            <p className="mt-3 text-sm text-ink-400">{subtitle}</p>
          </header>
        </Reveal>
        {children}
      </div>
    </section>
  )
}
