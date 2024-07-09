$(function () {
  function goto_with_query(url) {
    const search = window.location.search;
    window.open(`${url}${search}`, '_self');
  }

  $('#ms_login_btn').on('click', function () {
    goto_with_query('../api/auth/microsoft');
  });

  $('#google_login_btn').on('click', function () {
    goto_with_query('../api/auth/google');
  });
});
