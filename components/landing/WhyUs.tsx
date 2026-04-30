'use client';

const features = [
  {
    icon: '⚓',
    titleKey: 'why.1.title',
    descKey: 'why.1.desc',
    titleDefault: 'We come to your marina',
    descDefault: 'No need to move the boat. Our mobile team comes directly to your berth.',
  },
  {
    icon: '💬',
    titleKey: 'why.2.title',
    descKey: 'why.2.desc',
    titleDefault: 'Quote in 2 hours',
    descDefault: 'Clear pricing, no hidden fees. You know the cost before we start.',
  },
  {
    icon: '⚡',
    titleKey: 'why.3.title',
    descKey: 'why.3.desc',
    titleDefault: '48h turnaround',
    descDefault: 'Fast, reliable, guaranteed. We respect your time and your schedule.',
  },
];

export default function WhyUs() {
  return (
    <section className="py-20 bg-beige">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="section-title mb-3" data-i18n="why.title">Why choose MJP?</h2>
          <div className="w-16 h-1 bg-orange mx-auto rounded-full" />
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div
              key={f.titleKey}
              className="relative p-8 rounded-2xl bg-cream border border-beige-dark hover:border-gold/50 hover:shadow-md transition-all duration-300 group"
            >
              <div className="w-14 h-14 bg-gold/10 rounded-xl flex items-center justify-center text-3xl mb-5 group-hover:bg-orange/10 transition-colors">
                {f.icon}
              </div>
              <h3
                className="font-heading text-xl font-bold text-navy mb-3"
                data-i18n={f.titleKey}
              >
                {f.titleDefault}
              </h3>
              <p
                className="text-gray-500 leading-relaxed text-sm"
                data-i18n={f.descKey}
              >
                {f.descDefault}
              </p>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gold to-orange rounded-b-2xl scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
