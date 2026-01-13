<?php
$file = $_FILES['audio_file'];
move_uploaded_file($file['tmp_name'], $file['name']);
?>
