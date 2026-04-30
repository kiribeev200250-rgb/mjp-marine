'use client';

const steps = [
  {
    num: '01',
    icon: '📱',
    titleKey: 'hiw.1.title',
    descKey: 'hiw.1.desc',
    titleDefault: 'Contact us',
    descDefault: 'Call, WhatsApp, or fill in the form. We respond fast.',
  },
  {
    num: '02',
    icon: '📋',
    titleKey: 'hiw.2.title',
    descKey: 'hiw.2.desc',
    titleDefault: 'Quote in 2 hours',
    descDefault: 'You receive a clear, itemised quote with no surprises.',
  },
  {
    num: '03',
    icon: '🚐',
    titleKey: 'hiw.3.title',
    descKey: 'hiw.3.desc',
    titleDefault: 'We come to your marina',
    descDefault: 'Our certified technician arrives at your berth at the agreed time.',
  },
  {
    num: '04',
    icon: '✅',
    titleKey: 'hiw.4.title',
    descKey: 'hiw.4.desc',
    titleDefault: 'Job done. Back to sea.',
    descDefault: "We test everything, clean up, and you're ready to sail.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 bg-navy-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-100 mb-3" data-i18n="hiw.title">
            How It Works
          </h2>
          <div className="w-16 h-1 bg-gradient-to-r from-gold to-orange mx-auto rounded-full" />
        </div>

        <div className="grid md:grid-cols-4 gap-6 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-[12.5%] right-[12.5%] h-px bg-gold/20" />

          {steps.map((step, i) => (
            <div key={step.num} className="relative flex flex-col items-center text-center">
              {/* Step circle */}
              <div className="relative z-10 w-20 h-20 rounded-full border-2 border-gold/50 bg-navy-light flex flex-col items-center justify-center mb-5">
                <span className="text-orange text-xs font-bold tracking-widest">{step.num}</span>
                <span className="text-2xl">{step.icon}</span>
              </div>

              <h3
                className="font-heading text-lg font-bold text-gray-100 mb-2"
                data-i18n={step.titleKey}
              >
                {step.titleDefault}
              </h3>
              <p
                className="text-gray-400 text-sm leading-relaxed"
                data-i18n={step.descKey}
              >
                {step.descDefault}
              </p>

              {/* Arrow (mobile) */}
              {i < steps.length - 1 && (
                <div className="md:hidden mt-4 text-gold/40 text-2xl">↓</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
