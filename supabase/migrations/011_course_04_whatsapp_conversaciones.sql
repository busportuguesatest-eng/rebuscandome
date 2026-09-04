-- REBUSCÁNDOME — Curso 04: WhatsApp y Conversaciones que Convierten
-- Diseñado para almacenarse en la misma estructura course_modules/lessons.

DO $$
DECLARE
  v_course uuid;
  v_m1 uuid; v_m2 uuid; v_m3 uuid; v_m4 uuid; v_m5 uuid; v_m6 uuid; v_m7 uuid;
BEGIN
  INSERT INTO public.courses(title,slug,description,type,status)
  VALUES(
    'WhatsApp y Conversaciones que Convierten',
    'whatsapp-conversaciones-que-convierten',
    'Entrenamiento práctico para abrir conversaciones, detectar intención, presentar valor, responder objeciones, hacer seguimiento y cerrar con claridad.',
    'general',
    'published'
  )
  ON CONFLICT (slug) DO UPDATE SET
    title=excluded.title,
    description=excluded.description,
    status='published'
  RETURNING id INTO v_course;

  IF v_course IS NULL THEN
    SELECT id INTO v_course FROM public.courses WHERE slug='whatsapp-conversaciones-que-convierten';
  END IF;

  INSERT INTO public.course_modules(course_id,title,slug,description,position,estimated_minutes,icon,color_key,status)
  VALUES
  (v_course,'Antes de escribir','antes-de-escribir','Prepara una conversación que el prospecto quiera tener.',1,21,'🎯','blue','published'),
  (v_course,'Detecta intención','detecta-intencion','Aprende a distinguir curiosidad, interés y decisión.',2,23,'🧠','yellow','published'),
  (v_course,'Presenta el valor','presenta-el-valor','Explica la oferta sin convertir el chat en una ficha técnica.',3,25,'💎','green','published'),
  (v_course,'Objeciones sin presión','objeciones-sin-presion','Responde dudas con claridad y confianza.',4,25,'🛡️','blue','published'),
  (v_course,'Seguimiento inteligente','seguimiento-inteligente','Haz seguimiento con contexto y sin presión.',5,24,'🔁','yellow','published'),
  (v_course,'Cierre claro y ético','cierre-claro-y-etico','Convierte interés en decisión sin manipulación.',6,24,'✅','green','published'),
  (v_course,'Tu sistema de WhatsApp','tu-sistema-de-whatsapp','Integra apertura, diagnóstico, valor, seguimiento y cierre.',7,30,'🚀','navy','published')
  ON CONFLICT (course_id,slug) DO UPDATE SET
    title=excluded.title,
    description=excluded.description,
    position=excluded.position,
    estimated_minutes=excluded.estimated_minutes,
    icon=excluded.icon,
    color_key=excluded.color_key,
    status='published';

  SELECT id INTO v_m1 FROM public.course_modules WHERE course_id=v_course AND slug='antes-de-escribir';
  SELECT id INTO v_m2 FROM public.course_modules WHERE course_id=v_course AND slug='detecta-intencion';
  SELECT id INTO v_m3 FROM public.course_modules WHERE course_id=v_course AND slug='presenta-el-valor';
  SELECT id INTO v_m4 FROM public.course_modules WHERE course_id=v_course AND slug='objeciones-sin-presion';
  SELECT id INTO v_m5 FROM public.course_modules WHERE course_id=v_course AND slug='seguimiento-inteligente';
  SELECT id INTO v_m6 FROM public.course_modules WHERE course_id=v_course AND slug='cierre-claro-y-etico';
  SELECT id INTO v_m7 FROM public.course_modules WHERE course_id=v_course AND slug='tu-sistema-de-whatsapp';

  DELETE FROM public.lessons WHERE course_id=v_course;

  INSERT INTO public.lessons(course_id,module_id,title,content,lesson_type,estimated_minutes,objective,key_points,interactive_data,position,status) VALUES
  (v_course,v_m1,'WhatsApp no es un megáfono','WhatsApp funciona mejor como canal conversacional: contexto, escucha y siguiente paso.','content',6,'Preparar conversaciones útiles.','["Contexto","Escucha","Siguiente paso"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m1,'¿Conversación o anuncio?','Adaptar una respuesta al contexto es más útil que copiar un anuncio y pegarlo en un chat.','quiz',7,'Distinguir conversación de difusión.','["Contexto","Relevancia","Conversación"]','{"type":"multiple_choice","question":"Una persona te pregunta: ¿De qué se trata? ¿Qué respuesta es más adecuada?","options":["Te envío 8 mensajes seguidos","Te explico brevemente qué resuelve y, si te interesa, te muestro cómo funciona","Compra ahora mismo","Ignorar y enviar un catálogo"],"correctIndex":1}',2,'published'),
  (v_course,v_m1,'Tu apertura natural','Construye aperturas con contexto y una pregunta clara.','challenge',8,'Crear aperturas relevantes.','["Contexto","Pregunta","Fricción"]','{"type":"builder"}',3,'published'),

  (v_course,v_m2,'Señales de interés','Distingue curiosidad, interés y decisión para ajustar la conversación.','content',7,'Reconocer intención.','["Curiosidad","Interés","Decisión"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m2,'Clasifica al prospecto','Identifica el nivel de intención detrás de una pregunta.','quiz',8,'Leer señales de compra.','["Intención","Encaje","Contexto"]','{"type":"multiple_choice","question":"¿Me sirve si apenas estoy empezando? expresa principalmente…","options":["Curiosidad sin contexto","Evaluación de encaje","Compra confirmada","Rechazo"],"correctIndex":1}',2,'published'),
  (v_course,v_m2,'Pregunta de diagnóstico','Construye preguntas sobre situación, problema y objetivo.','challenge',8,'Diagnosticar antes de presentar.','["Situación","Problema","Objetivo"]','{"type":"builder"}',3,'published'),

  (v_course,v_m3,'De característica a beneficio','Traduce características en utilidad para la persona.','content',8,'Comunicar beneficios.','["Característica","Beneficio","Utilidad"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m3,'El mensaje que conecta','Elige la respuesta que mejor comunica valor.','quiz',8,'Comunicar valor con claridad.','["Valor","Claridad","Relevancia"]','{"type":"multiple_choice","question":"¿Qué respuesta comunica mejor valor?","options":["Tiene 80 páginas.","Es digital.","Te ayuda a resolver X de forma práctica, sin empezar desde cero.","Es premium."],"correctIndex":2}',2,'published'),
  (v_course,v_m3,'Tu presentación de 20 segundos','Construye una presentación breve: problema → solución → resultado → siguiente paso.','challenge',9,'Crear una presentación comercial breve.','["Problema","Solución","Resultado","CTA"]','{"type":"builder"}',3,'published'),

  (v_course,v_m4,'Qué significa una objeción','Una objeción puede indicar información insuficiente, riesgo o falta de encaje.','content',7,'Interpretar objeciones.','["Información","Riesgo","Encaje"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m4,'Simulador: Está caro','Practica una respuesta que reconozca la duda y devuelva el chat al valor.','simulation',9,'Responder sin presión.','["Empatía","Valor","Claridad"]','{"type":"multiple_choice","question":"Cliente: Está caro. ¿Cuál respuesta es más profesional?","options":["No, no está caro.","Entiendo la duda. Te muestro qué incluye y para qué tipo de persona está pensado; así puedes valorar si te conviene.","Compra antes de que suba.","Si no puedes pagarlo, no es para ti."],"correctIndex":1}',2,'published'),
  (v_course,v_m4,'Simulador: Lo voy a pensar','Aprende a dejar un siguiente paso claro sin perseguir.','simulation',9,'Cerrar con respeto.','["Respeto","Contexto","Siguiente paso"]','{"type":"multiple_choice","question":"¿Qué respuesta mantiene la conversación abierta?","options":["¿Qué hay que pensar?","Perfecto. Si te parece, te dejo la información clave y puedes escribirme cuando quieras revisarlo.","Te escribo en una hora.","Entonces no te interesa."],"correctIndex":1}',3,'published'),

  (v_course,v_m5,'Cuándo hacer seguimiento','El seguimiento debe aportar contexto o resolver una duda.','content',7,'Planificar follow-up útil.','["Contexto","Aporte","Frecuencia"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m5,'Ordena el seguimiento','Construye una secuencia: contexto → aporte → pregunta → CTA.','challenge',7,'Ordenar una secuencia de seguimiento.','["Contexto","Aporte","Pregunta","CTA"]','{"type":"sequence","items":["CTA final","Referencia a la conversación","Ayuda o recurso útil","Pregunta breve"],"correctOrder":[1,2,3,0]}',2,'published'),
  (v_course,v_m5,'Tu secuencia de 3 mensajes','Crea una secuencia para un prospecto que pidió información y no respondió.','challenge',10,'Crear seguimiento adaptable.','["Mensaje 1","Mensaje 2","Mensaje 3"]','{"type":"builder"}',3,'published'),

  (v_course,v_m6,'El momento de cerrar','El cierre funciona mejor cuando el valor y el siguiente paso ya están claros.','content',7,'Identificar momento de cierre.','["Valor","Claridad","Acción"]','{"type":"challenge"}',1,'published'),
  (v_course,v_m6,'Elige el cierre','Compara cierres claros frente a cierres de presión.','quiz',8,'Seleccionar cierres éticos.','["Claridad","Confianza","CTA"]','{"type":"multiple_choice","question":"¿Cuál cierre es más adecuado?","options":["Compra ya o pierdes la oportunidad.","Si esto encaja contigo, puedes revisar la información y acceder desde este enlace.","No me hagas perder tiempo.","Todos están comprando."],"correctIndex":1}',2,'published'),
  (v_course,v_m6,'Simulación final de chat','Practica diagnóstico → valor → objeción → cierre.','simulation',12,'Integrar la conversación completa.','["Diagnóstico","Valor","Objeción","Cierre"]','{"type":"multiple_choice","question":"Cliente: Me interesa, pero quiero saber si realmente me sirve. ¿Qué haces primero?","options":["Enviar el precio otra vez","Preguntar por su situación y objetivo para comprobar encaje","Presionarlo para comprar","Enviar 20 capturas"],"correctIndex":1}',3,'published'),

  (v_course,v_m7,'Construye tu guion maestro','Une apertura, diagnóstico, valor, objeción y CTA.','challenge',10,'Crear un guion adaptable.','["Apertura","Diagnóstico","Valor","Objeción","CTA"]','{"type":"builder"}',1,'published'),
  (v_course,v_m7,'Checklist de conversación','Revisa claridad, contexto y siguiente paso antes de enviar.','quiz',8,'Usar un checklist de calidad.','["Contexto","Utilidad","Siguiente paso"]','{"type":"multiple_choice","question":"¿Qué revisarías antes de enviar?","options":["Que sea largo","Que tenga contexto, utilidad y un siguiente paso claro","Que tenga emojis en cada línea","Que incluya cinco CTAs"],"correctIndex":1}',2,'published'),
  (v_course,v_m7,'Reto final: tu playbook','Construye tu playbook inicial para conversar con prospectos.','challenge',12,'Crear un activo comercial reutilizable.','["Aperturas","Preguntas","Objeciones","Seguimientos","Cierres"]','{"type":"final_challenge"}',3,'published');

  UPDATE public.course_modules current
  SET required_previous_module_id = prev.id
  FROM public.course_modules prev
  WHERE current.course_id=v_course
    AND prev.course_id=v_course
    AND prev.position=current.position-1;
END $$;

SELECT 'REBUSCÁNDOME: Curso 04 — WhatsApp y Conversaciones que Convierten instalado correctamente' AS result;
