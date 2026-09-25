-- =============================================================================
-- KIT CLÍNICA DE ESTÉTICA — os serviços
-- =============================================================================
--
-- O catálogo da Núcleo Clínica de Estética (Jundiaí), montado na instalação de
-- 25/09/2026 a partir do que a clínica cadastrou pela tela: 10 procedimentos,
-- cada um com a descrição curta (a do catálogo, que vai em toda conversa), a
-- completa (que a atendente busca quando alguém pergunta), o preço e a duração
-- do bloco na agenda — mais a avaliação como porta de entrada.
--
-- ⚠️ NÃO É UMA MIGRAÇÃO. Roda no SQL Editor do Supabase (ou com o token, como
-- a parte 3 do INSTALACAO.md aplica as migrações), depois das migrações.
--
-- O QUE ELE CADASTRA
--
--   • "Avaliação Estética" como a porta de entrada: 30 minutos, SEM valor
--     cadastrado (a atendente não fala preço dela). Se a avaliação for
--     gratuita, ponha 0 na tela; se for paga, o valor. Só pode existir uma
--     porta; se a empresa já tiver outra, esta linha é pulada, e os
--     procedimentos passam a apontar para a que já existe.
--   • 7 procedimentos que passam pela avaliação antes — os que a própria
--     clínica descreveu com "Necessita avaliação prévia". Os preços deles
--     ficam guardados, mas a atendente NÃO os fala: quem passa pela porta tem
--     o valor fechado na avaliação (é a view procedimentos_clinica_agente).
--   • 3 procedimentos que agendam direto, com o preço "a partir de".
--
-- Rodar de novo não duplica: serviço com o mesmo nome é pulado. O UPDATE do
-- fim garante a porta também nos procedimentos que já existiam.
--
-- ⚠️ OS TEXTOS PRECISAM DA REVISÃO de uma profissional da clínica antes de
-- irem para a boca da atendente — número de sessões, duração do efeito e
-- cuidados variam por caso. Sem nome de marca registrada: "Toxina
-- Botulínica", nunca o nome comercial.
--
-- DEPOIS DE RODAR: em Profissionais, marque a Avaliação Estética em "Serviços
-- que faz" de quem avalia. Profissional com a lista preenchida só faz o que
-- está nela — sem isso, ninguém pode ser agendado para a avaliação.
-- =============================================================================

insert into public.servicos_clinica
  (nome, descricao, descricao_longa, ativo, e_avaliacao, exige_avaliacao,
   preco_a_partir_de, duracao_minutos, created_at)
select v.nome, v.descricao, v.descricao_longa, true, v.e_avaliacao, v.exige_avaliacao,
       v.preco, v.duracao,
       -- Deslocamento crescente: a página Serviços ordena por `created_at`.
       now() + (v.ordem * interval '1 millisecond')
from (values
  ( 1, 'Avaliação Estética',
       'Primeira conversa com a profissional: ela avalia a pele ou a região do corpo, entende o que você quer e define o procedimento indicado',
       'É o primeiro atendimento. A profissional conversa sobre o que te incomoda e o que você espera, examina a pele ou a região do corpo e pergunta sobre a sua saúde: gravidez, amamentação, remédios, alergias e procedimentos anteriores. É nela que se define se o procedimento é indicado para você, qual o melhor caminho e quantas sessões costumam ser necessárias, com o valor. Dura cerca de 30 minutos e não tem nenhum procedimento invasivo.',
       true, false, null, 30),
  ( 2, 'Tratamento facial - Aplicação de Toxina Botulínica',
       'Suaviza rugas e linhas de expressão, promovendo um rosto mais jovem e descansado',
       'Procedimento rápido e seguro que relaxa a musculatura facial temporariamente. É focado em prevenir e tratar rugas dinâmicas, como os "pés de galinha" e as linhas da testa. O resultado começa a aparecer em alguns dias e dura de 4 a 6 meses. Por ser um tratamento injetável, requer uma avaliação prévia para alinhar as expectativas e definir os pontos exatos de aplicação.',
       false, true, 800.00, 30),
  ( 3, 'Tratamento facial - Preenchimento Facial',
       'Restaura o volume facial, hidrata e contorna lábios, maçãs do rosto e sulcos',
       'Utiliza ácido hialurônico para devolver o volume perdido com o processo de envelhecimento, harmonizar o rosto e preencher áreas mais profundas, como o "bigode chinês". O procedimento é minimamente invasivo, com resultados imediatos que podem durar até 12 meses. Nos primeiros dias, pode haver um leve inchaço local. A avaliação profissional é obrigatória para definir a quantidade ideal.',
       false, true, 1200.00, 60),
  ( 4, 'Tratamento facial - Limpeza de Pele Profunda',
       'Remove cravos, impurezas e células mortas, deixando a pele renovada e iluminada',
       'O cuidado essencial para a saúde do rosto. O passo a passo inclui higienização, esfoliação, extração de cravos e miliuns, uso de alta frequência para cicatrização e uma máscara calmante premium finalizadora. Indicado para todos os tipos de pele. Ideal para ser feito a cada 30 ou 40 dias, promovendo uma textura macia, limpa e preparada para absorver melhor seus cremes diários.',
       false, false, 180.00, 60),
  ( 5, 'Tratamento facial - Peeling químico',
       'Renovação celular profunda para tratar manchas, acne e linhas finas de expressão',
       'Consiste na aplicação de ácidos específicos no rosto para promover a descamação controlada e a renovação das células. É um excelente tratamento para clarear manchas (como melasma), secar espinhas ativas e afinar a textura da pele. Nos dias seguintes à aplicação, o rosto irá descamar e exigirá o uso rigoroso de protetor solar e hidratante. O tipo de ácido será definido na avaliação.',
       false, true, 350.00, 45),
  ( 6, 'Tratamento facial - Microagulhamento facial',
       'Estimula a produção de colágeno, reduzindo cicatrizes de acne, poros e flacidez',
       'Utiliza um dispositivo com microagulhas para criar microperfurações na pele, ativando a cicatrização natural e forçando a produção de novo colágeno. É perfeito para nivelar cicatrizes de acne, fechar poros dilatados e promover um rejuvenescimento global. O rosto pode ficar levemente avermelhado por até 48 horas. O tratamento inclui a aplicação de ativos concentrados (drug delivery).',
       false, true, 450.00, 60),
  ( 7, 'Tratamento corporal - Drenagem Linfática Corporal',
       'Massagem suave que reduz o inchaço, elimina toxinas e melhora a circulação',
       'Massagem terapêutica com movimentos rítmicos e pressão suave, focada em estimular o sistema linfático a eliminar o excesso de líquidos e toxinas do corpo. Altamente indicada para gestantes, fases de pós-operatório ou pessoas que sofrem com muita retenção de líquido. Promove relaxamento imediato, bem-estar e sensação de leveza. Pode ser realizada semanalmente.',
       false, false, 150.00, 60),
  ( 8, 'Tratamento corporal - Congelamento de Gordura Localizada',
       'Destrói células de gordura através do frio, ideal para abdômen, flancos e coxas',
       'Tratamento não invasivo que utiliza baixas temperaturas para congelar e destruir as células de gordura localizada, que são posteriormente eliminadas pelo próprio organismo ao longo de semanas. Ideal para aquelas gordurinhas resistentes a dietas e exercícios. O resultado final se consolida em até 90 dias. É necessária uma avaliação prévia para medir a área e verificar a indicação.',
       false, true, 600.00, 60),
  ( 9, 'Tratamento corporal - Massagem Modeladora',
       'Massagem vigorosa que modela os contornos do corpo e reduz medidas temporárias',
       'Técnica manual estética com movimentos rápidos, intensos e contínuos para atingir camadas mais profundas da pele. Auxilia na melhora da oxigenação dos tecidos, quebra de nódulos superficiais de celulite e modelagem do contorno corporal. Pode causar um leve desconforto devido à intensidade da pressão. Os melhores resultados surgem em pacotes contínuos associados a bons hábitos.',
       false, false, 160.00, 50),
  (10, 'Tratamento corporal - Depilação a Laser',
       'Eliminação duradoura dos pelos de forma rápida, segura e com muito conforto',
       'O método definitivo para a redução de pelos corporais e faciais. A tecnologia a laser emite uma luz que é absorvida pela melanina, destruindo a raiz do pelo. São necessárias, em média, 8 a 10 sessões para atingir o resultado ideal, com intervalos de 30 a 45 dias entre elas. Recomenda-se evitar exposição solar direta na área tratada antes e depois de cada sessão.',
       false, true, null, 60),
  (11, 'Tratamento corporal - Radiofrequência Corporal',
       'Combate a flacidez e a celulite através do aquecimento profundo e seguro da pele',
       'Utiliza um aparelho de alta tecnologia que emite ondas de calor para estimular a contração das fibras de colágeno existentes e ativar a produção de novas fibras. Excelente para tratar flacidez na região da barriga, coxas, glúteos e braços, além de melhorar significativamente a aparência da celulite. O procedimento é indolor, trazendo apenas a sensação de um aquecimento agradável na pele.',
       false, true, 200.00, 40)
) as v (ordem, nome, descricao, descricao_longa, e_avaliacao, exige_avaliacao, preco, duracao)
where not exists (
  select 1 from public.servicos_clinica s
   where lower(trim(s.nome)) = lower(trim(v.nome))
)
-- Uma porta só (índice `servicos_clinica_avaliacao_unica`): se a empresa já
-- tem uma, a avaliação daqui é pulada em vez de derrubar o arquivo inteiro.
on conflict do nothing;

-- Os que passam pela avaliação, também quando já existiam antes do kit.
update public.servicos_clinica
   set exige_avaliacao = true
 where not exige_avaliacao
   and nome in (
    'Tratamento facial - Aplicação de Toxina Botulínica',
    'Tratamento facial - Preenchimento Facial',
    'Tratamento facial - Peeling químico',
    'Tratamento facial - Microagulhamento facial',
    'Tratamento corporal - Congelamento de Gordura Localizada',
    'Tratamento corporal - Depilação a Laser',
    'Tratamento corporal - Radiofrequência Corporal'
   );


-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
--
--   select nome, e_avaliacao, exige_avaliacao, preco_a_partir_de, duracao_minutos
--     from public.servicos_clinica order by created_at;
--   -- 11 linhas; uma é a Avaliação Estética, com e_avaliacao = true
--
--   select procedimento from public.procedimentos_clinica_agente;
--   -- o catálogo como a atendente lê: 7 linhas com "Antes deste, marque
--   -- Avaliação Estética."
