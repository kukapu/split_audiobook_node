const fs = require('fs');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Configurar ffmpeg con el path estático
ffmpeg.setFfmpegPath(ffmpegStatic);

// Función hipotética para detectar silencios
// Deberás implementar esta lógica
async function detectSilences(filePath, silenceThreshold) {
  // Duración del silencio en segundos y en dB
  const silenceDuration = silenceThreshold;
  const silenceDB = -30; // Ajusta este valor según tus necesidades

  return new Promise((resolve, reject) => {
      // Obtener la duración total del archivo primero
      ffmpeg.ffprobe(filePath, (err, metadata) => {
          if (err) {
              return reject(err);
          }

          const fileDuration = metadata.format.duration;

          // Ejecutar el comando para detectar silencios
          const command = `${ffmpegStatic} -i "${filePath}" -af silencedetect=noise=${silenceDB}dB:d=${silenceDuration} -f null -`;
          exec(command, (error, stdout, stderr) => {
              if (error) {
                  return reject(error);
              }

              // Procesar la salida de stderr para encontrar los silencios
              const silences = [];
              const regex = /silence_start: (\d+\.\d+)|silence_end: (\d+\.\d+)/g;
              let match;
              while ((match = regex.exec(stderr)) !== null) {
                  if (match[1]) { // silence_start
                      silences.push({ start: parseFloat(match[1]) });
                  } else if (match[2]) { // silence_end
                      silences[silences.length - 1].end = parseFloat(match[2]);
                  }
              }

              // Añadir la duración total del archivo como información al final del array
              silences.push({ start: fileDuration - 2, end: fileDuration + 2});

              resolve(silences);
          });
      });
  });
}

// Función para cortar el archivo de audio
function splitAudio(filePath, segments, outputFormat = 'mp3') {
    console.time('splitAudio')
    segments.forEach((segment, index) => {
        ffmpeg(filePath)
            .setStartTime(segment.start)
            .setDuration(segment.end - segment.start)
            .output(`Capitulo 0${index} - .${outputFormat}`)
            .on('end', () => {
              console.log(`Segment ${index + 1} done.`)
              if(index === segments.length - 1) {
                console.timeEnd('splitAudio')
              }
            })
            .run();
    });
}

function procesarCapitulos(arr) {
  // Iterar hacia atrás para evitar problemas al modificar el arreglo en la iteración
  for (let i = 0; i < arr.length - 1; i++) {
    // Verificar si la duración del capítulo actual es menor a 30
    if (arr[i].end - arr[i].start < 25) {
      // Si el capítulo es muy corto, ajustar el inicio del siguiente capítulo
      arr[i + 1].start = arr[i].start;
      // Eliminar el capítulo actual
      arr.splice(i, 1);
      // Ajustar el índice para revisar el nuevo elemento en la posición actual en la próxima iteración
      i--;
    }
  }
}

function generateNewArray(arr) {
  let newArray = [];
  for(let i = 0; i < arr.length; i++) {
      let newObj = {};
      if(i === 0) {
          newObj.start = 0;
          newObj.end = (arr[i].end - arr[i].start) / 2 + arr[i].start;
      } else {
          if(!arr[i].end) {
              arr[i].end = arr[i].start + 2
          }
          newObj.start = newArray[i-1].end;
          newObj.end = ((arr[i].end - arr[i].start) / 2) + arr[i].start;
      }
      newArray.push(newObj);
  }
  procesarCapitulos(newArray)
  return newArray;
}

// Uso de las funciones
const audioPath = './test.mp3';
const silenceThreshold = 3.5; // Duración en segundos para considerar un silencio

console.time()
detectSilences(audioPath, silenceThreshold).then((segments) => {
  console.log('silences', segments); // Haz algo con los segmentos detectados
  console.log('chapters', generateNewArray(segments)); // Haz algo con los segmentos detectados
  splitAudio(audioPath,  generateNewArray(segments));
  console.timeEnd()
}).catch((error) => {
  console.error('Error detecting silences:', error);
});
