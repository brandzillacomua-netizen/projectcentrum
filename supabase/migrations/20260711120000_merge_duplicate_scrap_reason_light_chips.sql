do $$
declare
  v_old_id uuid := '2815abf0-f666-421a-adc0-5b8bbb1ac1ed';
  v_new_id uuid := '39113a5e-8930-455a-bbea-d6a939050375';
  v_old_name text := 'легенькі сколи -потребує косметичного ремонту';
  v_new_name text := 'Легкі сколи-потребує косметичного ремонту';
begin
  if exists (select 1 from public.scrap_reasons where id = v_old_id)
     and exists (select 1 from public.scrap_reasons where id = v_new_id) then

    update public.scrap_classification_reasons new_row
      set quantity = new_row.quantity + old_row.quantity,
          reason_name = v_new_name
    from public.scrap_classification_reasons old_row
    where old_row.reason_id = v_old_id
      and new_row.reason_id = v_new_id
      and new_row.classification_id = old_row.classification_id;

    delete from public.scrap_classification_reasons old_row
    where old_row.reason_id = v_old_id
      and exists (
        select 1
        from public.scrap_classification_reasons new_row
        where new_row.reason_id = v_new_id
          and new_row.classification_id = old_row.classification_id
      );

    update public.scrap_classification_reasons
      set reason_id = v_new_id,
          reason_name = v_new_name
    where reason_id = v_old_id;

    update public.work_card_history
      set qc_scrap_comment = replace(qc_scrap_comment, v_old_name, v_new_name)
    where qc_scrap_comment like '%' || v_old_name || '%';

    delete from public.scrap_reasons
    where id = v_old_id;
  end if;
end $$;
