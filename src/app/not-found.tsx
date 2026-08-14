import { LICENSE_PRODUCT } from "@shared/catalog";
import { ProductArt } from "@/components/ProductArt";
import { Button, CtaButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
      <ProductArt
        art={LICENSE_PRODUCT.tiers[0].art}
        blurred
        className="h-32 w-full max-w-sm rounded-xl2 border border-ink-100"
      />
      <span className="eyebrow mt-8">404</span>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-900">
        Nothing rendered here
      </h1>
      <p className="mt-3 max-w-md text-ink-600">
        That page doesn&apos;t exist. The catalog, your dashboard and the studio all still do.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <CtaButton href="/pricing">Back to pricing</CtaButton>
        <Button href="/" variant="secondary" size="lg">
          Home
        </Button>
      </div>
    </main>
  );
}
