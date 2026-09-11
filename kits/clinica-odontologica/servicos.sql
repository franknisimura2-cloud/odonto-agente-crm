-- =============================================================================
-- KIT CLÍNICA ODONTOLÓGICA — os serviços
-- =============================================================================
--
-- O catálogo da clínica odontológica onde o Núcleo nasceu: 20 serviços, cada
-- um com a descrição curta (a do catálogo, que vai em toda conversa), a
-- completa (que a atendente busca quando alguém pergunta), a duração do bloco
-- na agenda e a avaliação como porta de entrada.
--
-- ⚠️ NÃO É UMA MIGRAÇÃO. A instalação do Núcleo nasce sem serviço nenhum
-- (migração 0025). Este arquivo roda UMA vez, no SQL Editor do Supabase,
-- depois das migrações — e só quando a empresa é uma clínica odontológica.
--
-- O QUE ELE CADASTRA
--
--   • "Avaliação Odontológica" como a porta de entrada: sem custo, 30 minutos.
--     Só pode existir uma porta; se a empresa já tiver outra, esta linha é
--     pulada, e os tratamentos passam a apontar para a que já existe.
--   • 17 tratamentos que passam pela avaliação antes.
--   • Limpeza e Profilaxia e Clareamento Dental, que agendam direto, sem valor
--     cadastrado.
--
-- Rodar de novo não duplica: serviço com o mesmo nome é pulado.
--
-- ⚠️ OS TEXTOS SÃO RASCUNHO e precisam da revisão de um dentista da clínica
-- antes de irem para a boca da atendente — prazos, número de sessões e
-- condutas variam por clínica e por caso. Sem nome de marca registrada: é
-- "Alinhadores Transparentes", nunca o nome comercial.
--
-- Depois de rodar, abra a página Serviços: confira os textos, preencha os
-- valores que a clínica aceita falar e desligue o que ela não faz.
-- =============================================================================

insert into public.servicos_clinica
  (nome, descricao, descricao_longa, ativo, e_avaliacao, exige_avaliacao,
   preco_a_partir_de, duracao_minutos, created_at)
select v.nome, v.descricao, v.descricao_longa, true, v.e_avaliacao, v.exige_avaliacao,
       v.preco, v.duracao,
       -- Deslocamento crescente: a página Serviços ordena por `created_at`, e
       -- vinte `now()` iguais deixariam a ordem por conta do acaso.
       now() + (v.ordem * interval '1 millisecond')
from (values
  ( 1, 'Avaliação Odontológica',
       'Primeira consulta: o dentista examina, conversa sobre o que você quer e monta o plano de tratamento',
       'É a primeira consulta. O dentista examina os dentes, a gengiva e a mordida, faz um escaneamento e algumas fotos, e monta uma simulação do resultado no computador. Você vê como o seu sorriso pode ficar antes de decidir qualquer coisa. Dura cerca de uma hora, não dói e não tem nenhum procedimento invasivo. É nela que sai o plano de tratamento com as opções que fazem sentido para o seu caso.',
       true, false, 0, 30),
  ( 2, 'Lentes de Contato',
       'Lâminas finíssimas de porcelana coladas na frente dos dentes para mudar cor e formato',
       'São lâminas finíssimas de porcelana coladas na frente dos dentes. Mudam a cor, o formato e o alinhamento aparente do sorriso, e não escurecem com café ou vinho. Em geral são de duas a quatro sessões, com dentes provisórios entre elas. É feito com anestesia local e costuma ser tranquilo, com alguma sensibilidade nos primeiros dias. Pede escovação, limpeza regular na clínica e placa para quem range os dentes.',
       false, true, null, 60),
  ( 3, 'Facetas em Resina',
       'Camadas de resina aplicadas sobre o dente para corrigir cor, forma ou pequenas falhas',
       'São camadas de resina aplicadas sobre o dente para corrigir cor, formato, pequenas fraturas ou espaços. O dentista esculpe ali mesmo, na cadeira, e você sai da consulta já com o resultado. Costuma levar menos sessões que a porcelana e quase nunca precisa de anestesia. A resina pigmenta com café e vinho e pede polimento de tempos em tempos. Na avaliação o dentista compara resina e porcelana para o seu caso.',
       false, true, null, 60),
  ( 4, 'Clareamento Dental',
       'Gel clareador que remove manchas e deixa os dentes vários tons mais claros',
       'Usa um gel que remove manchas e deixa os dentes vários tons mais claros. Tem a versão feita na clínica, mais rápida, e a caseira, com moldeiras sob medida. Muita gente faz as duas. Não dói, mas é comum sentir sensibilidade durante e logo depois, e isso passa. Nos primeiros dias vale evitar café, vinho tinto, molho de tomate e cigarro. O gel age só no dente natural: resina e porcelana não clareiam, então restaurações da frente podem precisar de troca depois.',
       false, false, null, 60),
  ( 5, 'Gengivoplastia',
       'Pequena cirurgia que ajusta o contorno da gengiva quando ela cobre demais os dentes',
       'É uma pequena cirurgia que ajusta o contorno da gengiva. Indicada para quem acha que mostra gengiva demais ao sorrir, ou tem dentes de tamanhos desiguais por causa do desenho dela. Uma sessão, com anestesia local, costuma levar menos de uma hora. Você não sente dor durante, e o pós tem inchaço leve por alguns dias. A gengiva leva algumas semanas para assentar. Muitas vezes é combinada com lentes ou facetas.',
       false, true, null, 60),
  ( 6, 'Alinhadores Transparentes',
       'Placas removíveis e quase invisíveis que alinham os dentes no lugar do aparelho fixo',
       'São placas removíveis, feitas sob medida e quase invisíveis, que vão movendo os dentes até a posição planejada. Você tira para comer e escovar, o que facilita a higiene. A cada etapa troca por uma placa nova. Não dói, mas é normal sentir pressão nos primeiros dias de cada troca. O tempo total depende de quanto os dentes precisam se mover, e sai depois do escaneamento. No fim, você usa uma contenção para os dentes não voltarem.',
       false, true, null, 60),
  ( 7, 'Implante Unitário',
       'Pino de titânio fixado no osso para substituir a raiz de um dente perdido, com coroa por cima',
       'Repõe um dente perdido. O dentista coloca um pino de titânio no osso, que faz o papel da raiz, e sobre ele vai uma coroa com aparência de dente natural. Não precisa desgastar os dentes vizinhos. São etapas: a cirurgia, alguns meses para o osso integrar, e depois a coroa definitiva. Em boa parte dos casos dá para usar um provisório nesse período. A cirurgia é com anestesia local e o pós tem inchaço por alguns dias.',
       false, true, null, 60),
  ( 8, 'Carga Imediata',
       'Implante e dente provisório instalados na mesma sessão, sem ficar sem o dente',
       'É quando o implante e um dente provisório são colocados na mesma sessão. Você entra sem o dente e sai com ele, sem esperar com o espaço aparecendo. O provisório fica até o osso integrar, e depois vem o definitivo. Cirurgia com anestesia local, e pós parecido com o de um implante comum. Nos primeiros meses a orientação é evitar forçar a mordida daquele lado. Nem todo caso permite: depende do osso, e o exame de imagem mostra.',
       false, true, null, 60),
  ( 9, 'Prótese Fixa sobre Implantes',
       'Arcada inteira de dentes fixos apoiada em implantes, para quem perdeu todos ou quase todos',
       'É uma arcada inteira de dentes fixos apoiada em implantes, para quem perdeu todos ou quase todos os dentes de uma arcada. Diferente da dentadura, não sai da boca: devolve firmeza para mastigar e acaba com o medo de a prótese soltar ao falar. São etapas: exames, cirurgia, integração e a prótese definitiva. Em muitos casos dá para sair da cirurgia já com uma provisória fixa. Pede higiene específica e revisões regulares.',
       false, true, null, 60),
  (10, 'Enxerto Ósseo',
       'Reconstrói o osso perdido para que a região consiga receber um implante',
       'Reconstrói o osso na região onde ele foi perdido, para que ela consiga receber um implante. A perda costuma acontecer quando o dente ficou muito tempo ausente, ou por doença na gengiva. O material colocado serve de base para o corpo formar osso novo ali. É feito com anestesia local, e o pós tem inchaço por alguns dias e alimentação macia. O tempo até o implante varia com o tamanho da área. Só o exame de imagem mostra se falta osso.',
       false, true, null, 60),
  (11, 'Levantamento de Seio Maxilar',
       'Cria altura óssea no fundo da arcada superior para viabilizar o implante',
       'Cria altura de osso na parte de trás da arcada de cima, para viabilizar um implante ali. Acima dos dentes superiores existe uma cavidade natural, o seio maxilar. Quando um dente dessa região é perdido há muito tempo, o osso diminui e não sobra altura. O procedimento levanta a membrana dessa cavidade e coloca enxerto no espaço. Anestesia local, inchaço por alguns dias e orientações como evitar assoar o nariz com força. Às vezes o implante entra na mesma cirurgia.',
       false, true, null, 60),
  (12, 'Prótese Dentária',
       'Reposição de dentes perdidos ou danificados, com o tipo definido na avaliação',
       'Repõe dentes perdidos ou muito danificados. Há as fixas, que ficam presas em dentes ou implantes e não saem da boca, e as removíveis, que você tira para higienizar. Uma prótese bem feita devolve a aparência do sorriso e a capacidade de mastigar bem. O caminho passa por moldagem ou escaneamento, provas de cor e formato, e ajustes até ficar confortável. Com o tempo a boca muda e ela pede ajuste ou troca.',
       false, true, null, 60),
  (13, 'Tratamento de Canal',
       'Remove o nervo inflamado de dentro do dente, acaba com a dor e preserva o dente',
       'Salva um dente cujo nervo inflamou ou infeccionou, geralmente por cárie profunda, fratura ou pancada. O dentista remove esse tecido, limpa os canais e os preenche. A fama de tratamento dolorido vem de outra época: hoje é feito com anestesia, e costuma ser justamente o que acaba com a dor. Pode levar uma ou mais sessões. Nos primeiros dias o dente fica sensível à mordida. Depois ele costuma precisar de uma restauração maior ou de coroa.',
       false, true, null, 60),
  (14, 'Placa de Bruxismo',
       'Placa sob medida para dormir, que protege os dentes de quem range ou aperta',
       'É uma placa feita sob medida, para dormir, que protege os dentes de quem range ou aperta à noite. O bruxismo desgasta o esmalte, trinca dentes e restaurações, e costuma vir com dor de cabeça ao acordar. A placa não cura o hábito, mas recebe a força no lugar dos dentes. O dentista escaneia ou molda a sua boca, e depois há uma sessão de ajuste. É normal estranhar nas primeiras noites. Quem fez trabalho estético costuma precisar dela.',
       false, true, null, 60),
  (15, 'Tratamento de DTM',
       'Trata a dor na articulação da mandíbula, que causa estalo, travamento e dor de cabeça',
       'DTM são os problemas na articulação que liga a mandíbula ao crânio, aquela que se mexe na frente da orelha. Os sinais comuns são estalo ao abrir a boca, dor no rosto ou perto do ouvido, travamento e dor de cabeça frequente. O tratamento depende da causa e pode envolver placa, ajuste na mordida, mudança de hábitos e encaminhamento para fisioterapia. Não é um procedimento único, é acompanhamento. O primeiro passo é sempre a avaliação.',
       false, true, null, 60),
  (16, 'Limpeza e Profilaxia',
       'Remoção de placa e tártaro com polimento final, indicada a cada seis meses',
       'É a limpeza profissional: o dentista remove a placa e o tártaro que a escovação em casa não alcança, inclusive abaixo da linha da gengiva, e termina com um polimento. É o procedimento mais simples e o que mais evita problema caro depois. Leva de trinta minutos a uma hora, em uma sessão, e quase nunca precisa de anestesia. Pode incomodar um pouco quem está com a gengiva inflamada. A recomendação geral é a cada seis meses.',
       false, false, null, 60),
  (17, 'Raspagem',
       'Limpeza profunda que retira o tártaro abaixo da gengiva, onde a escova não alcança',
       'É a remoção do tártaro que se acumulou abaixo da linha da gengiva, na raiz do dente, onde a escovação não chega. É mais profunda que a limpeza de rotina, e feita em quem já tem a gengiva comprometida. Costuma ser dividida por regiões da boca, em mais de uma sessão, com anestesia local para você não sentir nada. Depois a gengiva fica sensível por alguns dias. O resultado depende da higiene em casa: sem ela, o tártaro volta.',
       false, true, null, 60),
  (18, 'Tratamento Periodontal',
       'Trata a gengiva inflamada ou sangrando e o osso afetado, evitando a perda do dente',
       'Trata a gengiva inflamada que sangra, e o osso que sustenta os dentes quando já foi afetado. É a chamada doença periodontal. Os sinais são gengiva vermelha ou inchada, sangramento ao escovar, mau hálito persistente e, nos casos avançados, dentes que amolecem. Começa com a limpeza profunda das raízes, com anestesia e dividida em sessões. O osso já perdido não volta, mas dá para parar a perda: quanto antes começar, mais dente se preserva.',
       false, true, null, 60),
  (19, 'Enxerto Gengival',
       'Recupera a gengiva que retraiu e deixou a raiz do dente exposta e sensível',
       'Recupera a gengiva que retraiu e deixou a raiz do dente exposta. Quando isso acontece, o dente parece mais comprido e fica sensível ao gelado. A retração vem de escovação com força demais, doença na gengiva, bruxismo ou da anatomia da pessoa. O dentista recobre a área com tecido, devolvendo a proteção e melhorando a aparência do sorriso. É com anestesia local, e o pós pede alimentação macia por alguns dias. A causa também precisa ser tratada.',
       false, true, null, 60),
  (20, 'Extração de Siso',
       'Remoção do dente do siso quando nasce torto, fica entalado ou causa dor e infecção',
       'É a remoção do dente do siso, o último a nascer, geralmente entre os 17 e os 25 anos. Nem todo siso precisa sair: o problema é quando ele nasce torto, fica preso, empurra os vizinhos ou vive inflamando. Como fica no fundo, é difícil de higienizar. A cirurgia é com anestesia local e você não sente dor durante. O pós tem inchaço e incômodo nos primeiros dias, com pico por volta do segundo, e gelo e repouso resolvem bem. Só a radiografia mostra se os seus precisam sair.',
       false, true, null, 60)
) as v (ordem, nome, descricao, descricao_longa, e_avaliacao, exige_avaliacao, preco, duracao)
where not exists (
  select 1 from public.servicos_clinica s
   where lower(trim(s.nome)) = lower(trim(v.nome))
)
-- Uma porta só (índice `servicos_clinica_avaliacao_unica`): se a empresa já
-- tem uma, a avaliação daqui é pulada em vez de derrubar o arquivo inteiro.
on conflict do nothing;


-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
--
--   select nome, e_avaliacao, exige_avaliacao, duracao_minutos
--     from public.servicos_clinica order by created_at;
--   -- 20 linhas; a primeira é a Avaliação Odontológica, com e_avaliacao = true
--
--   select procedimento from public.procedimentos_clinica_agente;
--   -- o catálogo como a atendente lê
