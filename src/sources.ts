/** References used on the website, in APA 7 as in the seminar paper. Pages cite them with <Cite id="…" />
 *  and list them at the bottom with <Notes ids={[…]}>. */
export interface Source { text: string; url?: string }

export const SOURCES: Record<string, Source> = {
  paper: {
    text: 'Blumenthal, L., Bühler, A., Dreier, D., Massaro, I., Pühringer, A. V., & Raschle, J. (2026). Polo Coin: Instant, low-cost payments for the polo economy [Seminar thesis]. University of Zurich.',
  },
  fsb2025: {
    text: 'Financial Stability Board. (2025, October 9). G20 roadmap for enhancing cross-border payments: Consolidated progress report for 2025.',
    url: 'https://www.fsb.org/uploads/P091025.pdf',
  },
  cpmi2022: {
    text: 'Committee on Payments and Market Infrastructures. (2022). SWIFT gpi data indicate drivers of fast cross-border payments. Bank for International Settlements.',
    url: 'https://www.bis.org/cpmi/publ/swift_gpi.htm',
  },
  du2026: {
    text: 'Du, W., Huang, C., & Scharfstein, D. (2026). Competing rails for cross-border payments: Banks, fintechs, and stablecoins (BIS Working Papers No. 1385). Bank for International Settlements.',
    url: 'https://www.bis.org/publications/working-paper-1385-competing-rails-crossborder-payments-banks-fintechs-and-stablecoins.pdf',
  },
  swift2024: {
    text: 'Swift. (2024, October 17). Swift cross-border payment processing speed stretches further ahead of G20 target [Press release].',
    url: 'https://www.swift.com/news-events/press-releases/swift-cross-border-payment-processing-speed-stretches-further-ahead-g20-target',
  },
  nilsson2022: {
    text: 'Nilsson, T., Bouther, R., Van Acoleyen, M., & Cohen, L. (2022, February 8). SWIFT gpi data indicate drivers of fast cross-border payments. Committee on Payments and Market Infrastructures, BIS.',
    url: 'https://www.bis.org/publications/swift-gpi-data-indicate-drivers-fast-cross-border-payments',
  },
  rice2020: {
    text: 'Rice, T., von Peter, G., & Boar, C. (2020). On the global retreat of correspondent banks. BIS Quarterly Review, March 2020, 37–52.',
    url: 'https://www.bis.org/publ/qtrpdf/r_qt2003g.htm',
  },
  ganley2019: {
    text: 'Ganley, M. (2019, December 30). Why the long face? The economics of Argentina’s polo horse exports. Quarterra Consulting & Advisory.',
    url: 'https://quarterraglobal.com/blog/2019/12/30/why-the-long-face-the-economics-of-argentinas-polo-horse-exports',
  },
  infocampo2026: {
    text: 'Infocampo. (2026, January 8). Caballos argentinos, cada vez más cotizados: crecen las exportaciones y el valor agregado.',
    url: 'https://www.infocampo.com.ar/caballos-argentinos-cada-vez-mas-cotizados-crecen-las-exportaciones-y-el-valor-agregado/',
  },
  chainalysis2024: {
    text: 'Chainalysis. (2024, October 9). Latin America’s search for economic stability: The rise of stablecoins amid volatility.',
    url: 'https://www.chainalysis.com/blog/2024-latin-america-crypto-adoption/',
  },
  catalini2022: {
    text: 'Catalini, C., de Gortari, A., & Shah, N. (2022). Some simple economics of stablecoins. Annual Review of Financial Economics, 14, 117–135.',
    url: 'https://doi.org/10.1146/annurev-financial-111621-101151',
  },
  akerlof1970: {
    text: 'Akerlof, G. A. (1970). The market for “lemons”: Quality uncertainty and the market mechanism. The Quarterly Journal of Economics, 84(3), 488–500.',
    url: 'https://doi.org/10.2307/1879431',
  },
  dechert2025: {
    text: 'Dechert. (2025, August 22). The GENIUS Act for asset managers: What to know.',
    url: 'https://www.dechert.com/knowledge/onpoint/2025/8/the-genius-act-for-asset-managers--what-to-know.html',
  },
  kramer2024: {
    text: 'Kramer, S., Leisinger, B., Eckert, F., & Wherlock, A. (2024, July 29). FINMA publishes guidance on stablecoins. Homburger.',
    url: 'https://homburger.ch/en/insights/finma-publishes-guidance-on-stablecoins',
  },
  efd2025: {
    text: 'Eidgenössisches Finanzdepartement. (2025, October 22). Änderung des Finanzinstitutsgesetzes (Zahlungsmittelinstitute und Krypto-Institute): Erläuternder Bericht zur Eröffnung des Vernehmlassungsverfahrens.',
    url: 'https://bfadmin.cdbf.ch/Serveur/documents/7943',
  },
  bis2025: {
    text: 'Bank for International Settlements. (2025). The next-generation monetary and financial system. In Annual economic report 2025 (Chapter III).',
    url: 'https://www.bis.org/publ/arpdf/ar2025e3.pdf',
  },
  wise_b: {
    text: 'Wise. (n.d.). Guide to ARS transfers. Wise Help Centre. Retrieved November 5, 2026.',
    url: 'https://wise.com/help/articles/2962718/ars-transfers',
  },
  circle2025: {
    text: 'Circle Internet Group. (2025). Form S-1 registration statement. U.S. Securities and Exchange Commission.',
    url: 'https://www.sec.gov/Archives/edgar/data/1876042/000119312525070481/d737521ds1.htm',
  },
  moore2014: {
    text: 'Moore, G. A. (2014). Crossing the chasm: Marketing and selling disruptive products to mainstream customers (3rd ed.). HarperBusiness.',
  },
  collins1996: {
    text: 'Collins, J. C., & Porras, J. I. (1996). Building your company’s vision. Harvard Business Review, 74(5), 65–77.',
  },
  osterwalder2010: {
    text: 'Osterwalder, A., & Pigneur, Y. (2010). Business model generation: A handbook for visionaries, game changers, and challengers. Wiley.',
  },
  rochet2003: {
    text: 'Rochet, J.-C., & Tirole, J. (2003). Platform competition in two-sided markets. Journal of the European Economic Association, 1(4), 990–1029.',
    url: 'https://doi.org/10.1162/154247603322493212',
  },
  helms2010: {
    text: 'Helms, M. M., & Nixon, J. (2010). Exploring SWOT analysis – where are we now? Journal of Strategy and Management, 3(3), 215–251.',
    url: 'https://doi.org/10.1108/17554251011064837',
  },
  laffaye2014: {
    text: 'Laffaye, H. A. (2014). Polo in Argentina: A history. McFarland.',
  },
  beccar2025: {
    text: 'Beccar Varela. (2025). Comunicación “A” 8336: Nuevas restricciones cruzadas para personas humanas aplicables a operaciones con títulos valores.',
    url: 'https://beccarvarela.com/novedades/comunicacion-a-8336-nuevas-restricciones-cruzadas-para-personas-humanas-aplicables-a-operaciones-con-titulos-valores/',
  },
};
