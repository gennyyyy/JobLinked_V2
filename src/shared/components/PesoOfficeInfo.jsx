export default function PesoOfficeInfo({ className = "text-xs" }) {
  return (
    <div className={`${className} text-muted-foreground space-y-0 leading-4`}>
      <p><a href="tel:+63442882653" className="hover:text-primary transition-colors">(044) 288 2653</a></p>
      <p><a href="mailto:sta.maria.pesooffice@gmail.com" className="hover:text-primary transition-colors">sta.maria.pesooffice@gmail.com</a></p>
    </div>
  );
}