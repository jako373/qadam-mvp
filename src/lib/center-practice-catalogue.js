export function eligibleCenterExercises(catalogue, age, adaptive, today) {
  const years=Number(age);
  if(!Array.isArray(catalogue)||!Number.isFinite(years))throw new Error('Каталог упражнений недоступен / Жаттығулар қолжетімсіз');
  const eligible=catalogue.filter(item=>item?.isActive!==false&&Number.isFinite(Number(item.ageMin))&&Number.isFinite(Number(item.ageMax))&&years>=Number(item.ageMin)&&years<=Number(item.ageMax));
  if(eligible.length<3)throw new Error('Недостаточно доступных упражнений для возраста ребёнка. Обратитесь в центр / Орталыққа хабарласыңыз.');
  const ids=new Set(eligible.map(item=>item.id));
  if(Object.entries(adaptive?.dailyPlans||{}).some(([day,plan])=>day>=today&&!plan.completedAt&&plan.items.some(item=>!ids.has(item.exerciseId))))throw new Error('Упражнение в сохранённом плане больше недоступно. Обратитесь в центр / Сақталған жоспарды орталықпен нақтылаңыз.');
  return eligible;
}
