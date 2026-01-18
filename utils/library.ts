import { LanguageCode, LibraryBook } from '../types';

export const LIBRARY: Record<LanguageCode, LibraryBook[]> = {
  en: [
    {
      title: "Alice's Adventures in Wonderland",
      author: "Lewis Carroll",
      chapters: [
        {
          title: "Chapter I: Down the Rabbit-Hole",
          text: "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, 'and what is the use of a book,' thought Alice 'without pictures or conversation?' So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her."
        },
        {
          title: "Chapter II: The Pool of Tears",
          text: "Curiouser and curiouser! cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English); 'now I'm opening out like the largest telescope that ever was! Good-bye, feet!' (for when she looked down at her feet, they seemed to be almost out of sight, they were getting so far off). 'Oh, my poor little feet, I wonder who will put on your shoes and stockings for you now, dears? I'm sure I shan't be able! I shall be a great deal too far off to trouble myself about you: you must manage the best way you can; --but I must be kind to them,' thought Alice, 'or perhaps they won't walk the way I want to go! Let me see: I'll give them a new pair of boots every Christmas.'"
        },
        {
          title: "Chapter III: A Caucus-Race and a Long Tale",
          text: "They were indeed a queer-looking party that assembled on the bank—the birds with draggled feathers, the animals with their fur clinging close to them, and all dripping wet, cross, and uncomfortable. The first question of course was, how to get dry again: they had a consultation about this, and after a few minutes it seemed quite natural to Alice to find herself talking familiarly with them, as if she had known them all her life. Indeed, she had quite a long argument with the Lory, who at last turned sulky, and would only say, 'I am older than you, and must know better'; and this Alice would not allow without knowing how old it was, and as the Lory positively refused to tell its age, there was no more to be said."
        },
        {
          title: "Chapter IV: The Rabbit Sends in a Little Bill",
          text: "It was the White Rabbit, trotting slowly back again, and looking anxiously about as it went, as if it had lost something; and she heard it muttering to itself 'The Duchess! The Duchess! Oh my dear paws! Oh my fur and whiskers! She'll get me executed, as sure as ferrets are ferrets! Where can I have dropped them, I wonder?' Alice guessed in a moment that it was looking for the fan and the pair of white kid gloves, and she very good-naturedly began hunting about for them, but they were nowhere to be seen—everything seemed to have changed since her swim in the pool, and the great hall, with the glass table and the little door, had vanished completely."
        },
        {
          title: "Chapter V: Advice from a Caterpillar",
          text: "The Caterpillar and Alice looked at each other for some time in silence: at last the Caterpillar took the hookah out of its mouth, and addressed her in a languid, sleepy voice. 'Who are you?' said the Caterpillar. This was not an encouraging opening for a conversation. Alice replied, rather shyly, 'I—I hardly know, sir, just at present—at least I know who I WAS when I got up this morning, but I think I must have been changed several times since then.' 'What do you mean by that?' said the Caterpillar sternly. 'Explain yourself!' 'I can't explain myself, I'm afraid, sir' said Alice, 'because I'm not myself, you see.'"
        }
      ]
    },
    {
      title: "Peter Pan",
      author: "J.M. Barrie",
      chapters: [
        {
          title: "Chapter 1: Peter Breaks Through",
          text: "All children, except one, grow up. They soon know that they will grow up, and the way Wendy knew was this. One day when she was two years old she was playing in a garden, and she plucked another flower and ran with it to her mother. I suppose she must have looked rather delightful, for Mrs. Darling put her hand to her heart and cried, 'Oh, why can't you remain like this for ever!' This was all that passed between them on the subject, but henceforth Wendy knew that she must grow up. You always know after you are two. Two is the beginning of the end."
        }
      ]
    },
    {
      title: "The Happy Prince",
      author: "Oscar Wilde",
      chapters: [
        {
          title: "The Happy Prince",
          text: "High above the city, on a tall column, stood the statue of the Happy Prince. He was gilded all over with thin leaves of fine gold, for eyes he had two bright sapphires, and a large red ruby glowed on his sword-hilt. He was very much admired indeed. 'He is as beautiful as a weathercock,' remarked one of the Town Councillors who wished to gain a reputation for having artistic tastes; 'only not quite so useful,' he added, fearing lest people should think him unpractical, which he really was not."
        }
      ]
    }
  ],
  es: [
    {
      title: "Don Quijote de la Mancha",
      author: "Miguel de Cervantes",
      chapters: [
        {
          title: "Capítulo I",
          text: "En un lugar de la Mancha, de cuyo nombre no quiero acordarme, no ha mucho tiempo que vivía un hidalgo de los de lanza en astillero, adarga antigua, rocín flaco y galgo corredor. Una olla de algo más vaca que carnero, salpicón las más noches, duelos y quebrantos los sábados, lantejas los viernes, algún palomino de añadidura los domingos, consumían las tres partes de su hacienda."
        }
      ]
    },
    {
      title: "Cuentos de la Selva",
      author: "Horacio Quiroga",
      chapters: [
        {
          title: "La Tortuga Gigante",
          text: "Había una vez un hombre que vivía en Buenos Aires y estaba muy contento porque era un hombre sano y trabajador. Pero un día se enfermó, y los médicos le dijeron que solamente yéndose al campo podría curarse. Él no quería ir, porque tenía hermanos chicos a quienes daba de comer; y se enfermaba cada día más. Hasta que un amigo suyo, que era director del Zoológico, le dijo un día: —Usted es amigo mío, y es un hombre bueno y trabajador. Por eso quiero que se vaya a vivir al monte, a hacer mucho ejercicio al aire libre para curarse."
        }
      ]
    }
  ],
  fr: [
    {
      title: "Cendrillon",
      author: "Charles Perrault",
      chapters: [
        {
          title: "L'histoire",
          text: "Il était une fois un Gentilhomme qui épousa en secondes noces une femme, la plus hautaine et la plus fière qu'on eût jamais vue. Elle avait deux filles de son humeur, et qui lui ressemblaient en toutes choses. Le Mari avait de son côté une jeune fille, mais d'une douceur et d'une bonté sans exemple ; elle tenait cela de sa Mère, qui était la meilleure personne du monde."
        }
      ]
    },
    {
      title: "Vingt mille lieues sous les mers",
      author: "Jules Verne",
      chapters: [
        {
          title: "Chapitre 1: Un écueil fuyant",
          text: "L'année 1866 fut marquée par un événement bizarre, un phénomène inexpliqué et inexplicable que personne n'a sans doute oublié. Sans parler des rumeurs qui agitaient les populations des ports et surexcitaient l'esprit public à l'intérieur des continents, les gens de mer furent particulièrement émus. Les négociants, armateurs, capitaines de navires, skippers et masters de l'Europe et de l'Amérique, officiers des marines militaires de tous pays, et, après eux, les gouvernements des divers États des deux continents, se préoccuppèrent de ce fait au plus haut point."
        }
      ]
    }
  ],
  de: [
    {
      title: "Märchen der Brüder Grimm",
      author: "Brüder Grimm",
      chapters: [
        {
          title: "Hänsel und Gretel",
          text: "Vor einem großen Walde wohnte ein armer Holzhacker mit seiner Frau und seinen zwei Kindern; das Bübchen hieß Hänsel und das Mädchen Gretel. Er hatte wenig zu beißen und zu brechen, und einmal, als große Teuerung ins Land kam, konnte er auch das tägliche Brot nicht mehr schaffen. Wie er sich nun abends im Bette Gedanken machte und sich vor Sorgen herumwälzte, seufzte er und sprach zu seiner Frau: 'Was soll aus uns werden? Wie können wir unsere armen Kinder ernähren, da wir für uns selbst nichts mehr haben?'"
        },
        {
          title: "Schneewittchen",
          text: "Es war einmal mitten im Winter, und die Schneeflocken fielen wie Federn vom Himmel herab, da saß eine Königin an einem Fenster, das einen Rahmen von schwarzem Ebenholz hatte, und nähte. Und wie sie so nähte und nach dem Schnee aufblickte, stach sie sich mit der Nadel in den Finger, und es fielen drei Tropfen Blut in den Schnee. Und weil das Rote im weißen Schnee so schön aussah, dachte sie bei sich: Hätt' ich ein Kind so weiß wie Schnee, so rot wie Blut und so schwarz wie das Holz am Rahmen."
        }
      ]
    }
  ],
  it: [
    {
      title: "Le Avventure di Pinocchio",
      author: "Carlo Collodi",
      chapters: [
        {
          title: "Capitolo 1",
          text: "C'era una volta... — Un re! — diranno subito i miei piccoli lettori. No, ragazzi, avete sbagliato. C'era una volta un pezzo di legno. Non era un legno di lusso, ma un semplice pezzo da catasta, di quelli che d'inverno si mettono nelle stufe e nei caminetti per accendere il fuoco e per riscaldare le stanze."
        }
      ]
    }
  ],
  ja: [
    {
      title: "桃太郎 (Momotaro)",
      author: "Traditional",
      chapters: [
        {
          title: "昔々",
          text: "昔々、あるところに、おじいさんとおばあさんが住んでいました。おじいさんは山へ芝刈りに、おばあさんは川へ洗濯に行きました。おばあさんが川で洗濯をしていると、ドンブラコ、ドンブラコと、大きな桃が流れてきました。「おや、これは良いお土産になるわ」とおばあさんは大きな桃を拾い上げて、家に持ち帰りました。"
        }
      ]
    },
    {
      title: "銀河鉄道の夜 (Night on the Galactic Railroad)",
      author: "Miyazawa Kenji",
      chapters: [
        {
          title: "午後の授業",
          text: "「ではみなさんは、そういうふうに川だと云われたり、乳の流れたあとだと云われたりしていたこのぼんやりと白いものがほんとうは何かご承知ですか。」先生は、黒板に吊した大きな黒い星座の図の、上から下へ白くけぶった銀河帯のようなところを指しながら、みんなに問をかけました。"
        }
      ]
    }
  ],
  ru: [
    {
      title: "Сказки (Fairy Tales)",
      author: "Alexander Pushkin",
      chapters: [
        {
          title: "У лукоморья дуб зелёный",
          text: "У лукоморья дуб зелёный; Златая цепь на дубе том: И днём и ночью кот учёный Всё ходит по цепи кругом; Идёт направо — песнь заводит, Налево — сказку говорит. Там чудеса: там леший бродит, Русалка на ветвях сидит..."
        }
      ]
    }
  ],
  pt: [
    {
      title: "O Alienista",
      author: "Machado de Assis",
      chapters: [
        {
          title: "Capítulo I",
          text: "As crônicas da vila de Itaguaí dizem que em tempos remotos vivera ali um certo médico, o Dr. Simão Bacamarte, filho da nobreza da terra e o maior dos médicos do Brasil, de Portugal e das Espanhas. Estudara em Coimbra e Pádua. Aos trinta e quatro anos regressou ao Brasil, não podendo el-rei alcançar dele que ficasse em Coimbra, regendo a universidade, ou em Lisboa, expedindo os negócios da monarquia."
        }
      ]
    }
  ],
  zh: [
    {
      title: "西游记 (Journey to the West)",
      author: "Wu Cheng'en",
      chapters: [
        {
          title: "第一回",
          text: "诗曰：混沌未分天地乱，茫茫渺渺无人见。自从盘古破鸿蒙，开辟从兹清浊辨。覆载群生仰至仁，发明万物皆成善。欲知造化会元功，须看西游释厄传。感盘古开辟，三皇治世，五帝定伦，世界之间，遂分为四大部洲：曰东胜神洲，曰西牛贺洲，曰南赡部洲，曰北俱芦洲。"
        }
      ]
    }
  ],
  uk: [
    {
      title: "Folk Tales",
      author: "Traditional",
      chapters: [
        {
          title: "Котигорошко",
          text: "Був собі один чоловік і мав шестеро синів та одну дочку. Пішли сини в поле орати і наказали, щоб сестра винесла їм обід. Вона й каже: — А де ж ви будете орати? Я не знаю. — Ми будемо, — кажуть, — тягти скибу від самого двору аж до тієї ниви, де будемо орати. То ти за тією скибою і йди."
        }
      ]
    }
  ]
};