import Link from "next/link";
import { ArrowUpRight, Heart } from "lucide-react";
import { services } from "@/lib/services";
export default function Home() {
  return (
    <main id="conteudo">
      <section className="hero home-hero">
        <span className="eyebrow">
          <span />
          BEM-VINDO AO NOSSO CANTINHO
          <span />
        </span>
        <h1>
          A vida fica mais bonita
          <br />
          <em>quando é compartilhada.</em>
        </h1>
        <p>
          Somos Fer e Gaby. Este é um pedacinho da nossa história, dos nossos
          sonhos e de tudo que a gente ama viver junto.
        </p>
        <div className="hero-heart">
          <Heart size={17} />
          <span>dois corações, tantas histórias</span>
        </div>
        <span className="decor decor-left" aria-hidden="true">
          ✳
        </span>
        <span className="decor decor-right" aria-hidden="true">
          ✧
        </span>
      </section>
      <section className="service-grid" aria-label="Nosso cantinho">
        {services.map((service) => (
          <Link
            href={service.href}
            key={service.href}
            className={`service-card ${service.theme}`}
          >
            <div className="service-art" aria-hidden="true">
              <service.icon size={60} strokeWidth={1} />
              <span>♡</span>
            </div>
            <div className="service-copy">
              <h2>{service.title}</h2>
              <p>{service.description}</p>
              <span className="service-action">
                {service.action}
                <ArrowUpRight size={20} />
              </span>
            </div>
          </Link>
        ))}
      </section>
      <aside className="love-note">
        <Heart size={20} />
        <p>
          O melhor da nossa história é quem faz parte dela.
          <span>Que bom ter você aqui.</span>
        </p>
      </aside>
    </main>
  );
}
