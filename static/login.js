$(function () {
  const params = new URLSearchParams(window.location.search);

  if (params.get('refresh_token') === '1') {
    $('#remember_me_checkbox').attr('checked', true);
  }

  $('#remember_me_checkbox').on('click', function () {
    if (this.checked) {
      params.set('refresh_token', '1');
    } else {
      params.delete('refresh_token');
    }
  });

  $('#ms_login_btn').on('click', function () {
    window.open(`../api/auth/microsoft?${params}`, '_self');
  });

  $('#google_login_btn').on('click', function () {
    window.open(`../api/auth/google?${params}`, '_self');
  });
});
