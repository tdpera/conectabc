"""Gera lib/data/enderecos-bc.json a partir do CNEFE (IBGE, Censo 2022).

Baixe 4202008_BALNEARIO_CAMBORIU.zip em https://ftp.ibge.gov.br/ (CNEFE > Censo 2022 > CSV > Municipio > 42_SC)
e rode: python3 scripts/build-enderecos.py caminho/4202008_BALNEARIO_CAMBORIU.csv
Só guarda rua, número, bairro e coordenada: nada de complementos nem nomes de estabelecimentos.
"""
import collections, csv, json, os, statistics, sys

AC = dict(p.split(":") for p in """ATLANTICA:Atlântica NACOES:Nações MUNICIPIOS:Municípios SAO:São JOAO:João JOSE:José ANTONIO:Antônio
CAMBORIU:Camboriú BALNEARIO:Balneário ESPERANCA:Esperança MARTIM:Martim PANAMA:Panamá MEXICO:México PARAISO:Paraíso
JAPAO:Japão URUGUAI:Uruguai EQUADOR:Equador COLOMBIA:Colômbia BOLIVIA:Bolívia GOIAS:Goiás PARANA:Paraná CEARA:Ceará
MARANHAO:Maranhão PIAUI:Piauí PARA:Pará AMAPA:Amapá RONDONIA:Rondônia BRASILIA:Brasília JULIO:Júlio LUCIA:Lúcia
MARIO:Mário ANDRE:André CONCEICAO:Conceição ANGELICA:Angélica FLORIANOPOLIS:Florianópolis ITAJAI:Itajaí CHAPECO:Chapecó
CRICIUMA:Criciúma ITALIA:Itália AFRICA:África AUSTRALIA:Austrália BELGICA:Bélgica CANADA:Canadá DINAMARCA:Dinamarca
ESPANHA:Espanha FRANCA:França GRECIA:Grécia HUNGRIA:Hungria SUICA:Suíça SUECIA:Suécia INDIA:Índia PEROLA:Pérola
CORINTIOS:Coríntios HIGINO:Higino IBIRAPUERA:Ibirapuera""".split())
SMALL = {"DE", "DA", "DO", "DAS", "DOS", "E"}


def pretty(s):
    ws = s.split()
    return " ".join(w.lower() if i and w in SMALL else AC.get(w, w.capitalize()) for i, w in enumerate(ws))


rows = collections.defaultdict(list)
for r in csv.DictReader(open(sys.argv[1], encoding="utf-8"), delimiter=";"):
    if r["NV_GEO_COORD"] not in "1234" or not r["LATITUDE"]:
        continue
    n = int(r["NUM_ENDERECO"] or 0)
    st = " ".join(x for x in (r["NOM_TIPO_SEGLOGR"], r["NOM_TITULO_SEGLOGR"], r["NOM_SEGLOGR"]) if x)
    if n > 0 and st:
        rows[st].append((n, float(r["LATITUDE"]), float(r["LONGITUDE"]), r["DSC_LOCALIDADE"], int(r["NV_GEO_COORD"])))

hoods, out, total = [], [], 0
def hood(h):
    h = pretty(h) if h and h != "BALNEARIO CAMBORIU" else ""
    if h not in hoods: hoods.append(h)
    return hoods.index(h)

for st in sorted(rows):
    by = collections.defaultdict(list)
    for r in rows[st]: by[r[0]].append(r)
    nums = []
    for n in sorted(by):
        g = by[n]
        best = min(x[4] for x in g)
        g = [x for x in g if x[4] == best]
        h = collections.Counter(x[3] for x in g).most_common(1)[0][0]
        # a coordenada registrada mais próxima da mediana (nunca um ponto médio entre dois lugares)
        ml, mg = statistics.median(x[1] for x in g), statistics.median(x[2] for x in g)
        p = min(g, key=lambda x: (x[1] - ml) ** 2 + (x[2] - mg) ** 2)
        nums.append([n, round(p[1] * 1e6), round(p[2] * 1e6), hood(h)])
        total += 1
    out.append([pretty(st), nums])
dst = os.path.join(os.path.dirname(__file__), "..", "lib", "data", "enderecos-bc.json")
json.dump({"hoods": hoods, "streets": out}, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "ruas", total, "endereços", os.path.getsize(dst), "bytes")
